"""Browser service for ai.spaincos.com (Tier 2 browsing).

A small FastAPI + Playwright (headless chromium) microservice. The Supabase
gateway calls it to navigate, read, click, fill and extract on real pages.

Security posture:
  - Every route needs `Authorization: Bearer <BROWSER_SERVICE_TOKEN>`; if the env
    var is unset every route is rejected (503).
  - http(s) only, SSRF blocked at navigation AND for every sub-request / redirect
    (hostname rules + DNS resolution to private IPs), no URL credentials.
  - Selectors must be plain CSS (no text=/xpath=/role= engines, no `>>` chains,
    no Playwright pseudo-classes). No page.evaluate with caller-supplied code.
  - Text only: no screenshots, PDFs, downloads or cookies are ever returned.
  - Logs contain only method/route/status, never URLs, selectors, values or text.
"""
import asyncio
import hmac
import ipaddress
import logging
import os
import re
import socket
import time
from collections import OrderedDict
from contextlib import asynccontextmanager
from typing import Optional
from urllib.parse import urlsplit

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from playwright.async_api import Browser, BrowserContext, Page, Playwright, async_playwright
from pydantic import BaseModel, Field

# ---------------- tunables ----------------
MAX_CONTEXTS = 20
IDLE_TTL_S = 5 * 60
REAP_INTERVAL_S = 30
NAV_TIMEOUT_MS = 15_000
ACTION_TIMEOUT_MS = 10_000
READ_TIMEOUT_MS = 8_000
READ_MAX_CHARS = 8_000
EXTRACT_MAX_ITEMS = 50
EXTRACT_ITEM_CHARS = 500
FILL_MAX_CHARS = 2_000
SELECTOR_MAX_CHARS = 300
ALLOWED_ORIGIN = "https://ai.spaincos.com"

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("browser-service")


# ---------------- SSRF guards ----------------
_BLOCKED_HOST_RE = re.compile(
    r"^(localhost|0\.0\.0\.0|::1|\[::1\])$|\.local$|\.internal$|\.localhost$"
    r"|^127\.|^10\.|^192\.168\.|^169\.254\.|^172\.(1[6-9]|2\d|3[01])\."
)


def _ip_is_blocked(ip: str) -> bool:
    try:
        a = ipaddress.ip_address(ip.split("%")[0])
    except ValueError:
        return True
    if isinstance(a, ipaddress.IPv6Address) and a.ipv4_mapped:
        a = a.ipv4_mapped
    return (a.is_private or a.is_loopback or a.is_link_local or a.is_multicast
            or a.is_reserved or a.is_unspecified)


_dns_cache: "dict[str, tuple[float, bool]]" = {}


async def _host_is_blocked(host: str) -> bool:
    host = host.strip("[]").lower().rstrip(".")
    if not host or _BLOCKED_HOST_RE.search(host):
        return True
    try:
        ipaddress.ip_address(host)
        return _ip_is_blocked(host)
    except ValueError:
        pass
    now = time.monotonic()
    hit = _dns_cache.get(host)
    if hit and hit[0] > now:
        return hit[1]
    try:
        infos = await asyncio.wait_for(
            asyncio.get_running_loop().getaddrinfo(host, None, type=socket.SOCK_STREAM), 5)
        blocked = any(_ip_is_blocked(i[4][0]) for i in infos)
    except Exception:
        blocked = True  # unresolvable -> treat as blocked
    if len(_dns_cache) > 2000:
        _dns_cache.clear()
    _dns_cache[host] = (now + 60, blocked)
    return blocked


async def check_url(raw: str) -> str:
    """Return a normalised URL or raise HTTPException(400)."""
    raw = (raw or "").strip()
    if not raw or len(raw) > 2048:
        raise HTTPException(400, "invalid url")
    try:
        u = urlsplit(raw)
        host = u.hostname or ""
        _ = u.port  # validates port
    except ValueError:
        raise HTTPException(400, "invalid url")
    if u.scheme not in ("http", "https"):
        raise HTTPException(400, "only http(s) URLs are allowed")
    if u.username or u.password or "@" in (u.netloc or ""):
        raise HTTPException(400, "urls with credentials are not allowed")
    if await _host_is_blocked(host):
        raise HTTPException(400, "that host is not allowed")
    return raw


# ---------------- selector validation (plain CSS only) ----------------
_SEL_ALLOWED_RE = re.compile(r"^[A-Za-z0-9_\-\s#.\[\]=:\"'()>+~*,^$|\\@/%!&;]+$")
_SEL_ENGINE_PREFIX_RE = re.compile(r"^\s*[A-Za-z][A-Za-z0-9_\-:]*\s*=")
_SEL_PW_PSEUDO_RE = re.compile(
    r":(has-text|text|text-is|text-matches|visible|nth-match|right-of|left-of|above|below|near|light)\b",
    re.I)


def check_selector(sel: str) -> str:
    sel = (sel or "").strip()
    if not sel or len(sel) > SELECTOR_MAX_CHARS:
        raise HTTPException(400, "invalid selector")
    if (sel[0] in "/'\"(" or ">>" in sel or "javascript:" in sel.lower()
            or "internal:" in sel.lower() or _SEL_ENGINE_PREFIX_RE.match(sel)
            or _SEL_PW_PSEUDO_RE.search(sel) or not _SEL_ALLOWED_RE.match(sel)):
        raise HTTPException(400, "selector must be a plain CSS selector")
    return sel


# ---------------- session registry ----------------
class Session:
    def __init__(self, ctx: BrowserContext, page: Page):
        self.ctx = ctx
        self.page = page
        self.last_used = time.monotonic()
        self.lock = asyncio.Lock()


_pw: Optional[Playwright] = None
_browser: Optional[Browser] = None
_sessions: "OrderedDict[str, Session]" = OrderedDict()
_registry_lock = asyncio.Lock()
_SID_RE = re.compile(r"^[A-Za-z0-9_\-]{8,128}$")


async def _close_session(s: Session) -> None:
    try:
        await asyncio.wait_for(s.ctx.close(), 5)
    except Exception:
        pass


async def _route_guard(route):
    """Block any request (incl. redirects / sub-resources) to a non-public host."""
    try:
        req_url = route.request.url
        scheme = urlsplit(req_url).scheme
        if scheme in ("data", "blob", "about"):
            await route.continue_()
            return
        if scheme not in ("http", "https", "ws", "wss"):
            await route.abort("blockedbyclient")
            return
        u = urlsplit(req_url)
        if u.username or u.password or await _host_is_blocked(u.hostname or ""):
            await route.abort("blockedbyclient")
            return
        await route.continue_()
    except Exception:
        try:
            await route.abort("failed")
        except Exception:
            pass


async def _new_session(sid: str) -> Session:
    assert _browser is not None
    ctx = await _browser.new_context(
        viewport={"width": 1280, "height": 900},
        accept_downloads=False,
        service_workers="block",
        java_script_enabled=True,
        locale="en-US",
    )
    ctx.set_default_timeout(ACTION_TIMEOUT_MS)
    ctx.set_default_navigation_timeout(NAV_TIMEOUT_MS)
    await ctx.route("**/*", _route_guard)
    page = await ctx.new_page()
    s = Session(ctx, page)

    def _on_page(p: Page) -> None:  # follow popups / target=_blank
        s.page = p
    ctx.on("page", _on_page)
    return s


async def get_or_create(sid: str) -> "tuple[Session, bool]":
    if not _SID_RE.match(sid or ""):
        raise HTTPException(400, "invalid session_id")
    async with _registry_lock:
        s = _sessions.get(sid)
        if s:
            s.last_used = time.monotonic()
            _sessions.move_to_end(sid)
            return s, False
        while len(_sessions) >= MAX_CONTEXTS:  # LRU eviction
            _, old = _sessions.popitem(last=False)
            await _close_session(old)
        s = await _new_session(sid)
        _sessions[sid] = s
        return s, True


async def require(sid: str) -> Session:
    async with _registry_lock:
        s = _sessions.get(sid)
        if not s:
            raise HTTPException(404, "unknown session; call /session first")
        s.last_used = time.monotonic()
        _sessions.move_to_end(sid)
        return s


async def _reaper() -> None:
    while True:
        await asyncio.sleep(REAP_INTERVAL_S)
        now = time.monotonic()
        async with _registry_lock:
            dead = [k for k, s in _sessions.items() if now - s.last_used > IDLE_TTL_S and not s.lock.locked()]
            for k in dead:
                await _close_session(_sessions.pop(k))


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _pw, _browser
    if not os.environ.get("BROWSER_SERVICE_TOKEN"):
        log.warning("BROWSER_SERVICE_TOKEN is not set: all routes will reject requests")
    _pw = await async_playwright().start()
    _browser = await _pw.chromium.launch(
        headless=True,
        args=["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
    )
    reaper = asyncio.create_task(_reaper())
    try:
        yield
    finally:
        reaper.cancel()
        for s in list(_sessions.values()):
            await _close_session(s)
        _sessions.clear()
        try:
            await _browser.close()
            await _pw.stop()
        except Exception:
            pass


app = FastAPI(title="ai.spaincos.com browser service", lifespan=lifespan,
              docs_url=None, redoc_url=None, openapi_url=None)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[ALLOWED_ORIGIN],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
    allow_credentials=False,
)


async def auth(authorization: Optional[str] = Header(default=None)) -> None:
    token = os.environ.get("BROWSER_SERVICE_TOKEN", "")
    if not token:
        raise HTTPException(503, "service not configured")
    scheme, _, supplied = (authorization or "").partition(" ")
    if scheme.lower() != "bearer" or not hmac.compare_digest(supplied.strip().encode(), token.encode()):
        raise HTTPException(401, "unauthorized")


@app.exception_handler(HTTPException)
async def http_exc(_: Request, exc: HTTPException):
    return JSONResponse({"error": str(exc.detail)}, status_code=exc.status_code)


@app.exception_handler(Exception)
async def any_exc(_: Request, exc: Exception):
    # Never echo internals (may contain URLs/page data).
    log.warning("unhandled %s", type(exc).__name__)
    return JSONResponse({"error": "internal error"}, status_code=500)


async def run_op(s: Session, coro_fn, timeout_s: float):
    """Serialise ops per session and enforce a hard wall-clock timeout."""
    async with s.lock:
        try:
            return await asyncio.wait_for(coro_fn(), timeout_s)
        except HTTPException:
            raise
        except asyncio.TimeoutError:
            raise HTTPException(504, "browser operation timed out")
        except Exception as e:
            name = type(e).__name__
            if "Timeout" in name:
                raise HTTPException(504, "browser operation timed out")
            raise HTTPException(502, "browser operation failed: " + name)


# ---------------- models ----------------
class SessionIn(BaseModel):
    session_id: Optional[str] = Field(default=None, max_length=128)


class NavigateIn(BaseModel):
    session_id: str = Field(max_length=128)
    url: str = Field(max_length=2048)


class ReadIn(BaseModel):
    session_id: str = Field(max_length=128)


class SelectorIn(BaseModel):
    session_id: str = Field(max_length=128)
    selector: str = Field(max_length=SELECTOR_MAX_CHARS)


class FillIn(SelectorIn):
    value: str = Field(max_length=FILL_MAX_CHARS)


# ---------------- routes ----------------
@app.get("/health", dependencies=[Depends(auth)])
async def health():
    return {"ok": True}


@app.post("/session", dependencies=[Depends(auth)])
async def session(body: SessionIn):
    import secrets
    sid = body.session_id or secrets.token_urlsafe(16)
    _, created = await get_or_create(sid)
    return {"session_id": sid, "created": created}


@app.post("/navigate", dependencies=[Depends(auth)])
async def navigate(body: NavigateIn):
    url = await check_url(body.url)
    s = await require(body.session_id)

    async def op():
        resp = await s.page.goto(url, wait_until="domcontentloaded", timeout=NAV_TIMEOUT_MS)
        try:  # give JS-rendered pages a brief chance to settle; never fatal
            await s.page.wait_for_load_state("load", timeout=3_000)
        except Exception:
            pass
        # Re-check the final URL (post-redirect) against the SSRF rules.
        final = s.page.url
        if final.startswith(("http://", "https://")):
            fu = urlsplit(final)
            if await _host_is_blocked(fu.hostname or ""):
                await s.page.goto("about:blank")
                raise HTTPException(400, "redirected to a host that is not allowed")
        return {"url": final, "title": (await s.page.title())[:300], "status": resp.status if resp else None}

    return await run_op(s, op, NAV_TIMEOUT_MS / 1000 + 5)


@app.post("/read", dependencies=[Depends(auth)])
async def read(body: ReadIn):
    s = await require(body.session_id)

    async def op():
        if s.page.url in ("", "about:blank"):
            raise HTTPException(400, "no page loaded; navigate first")
        text = await s.page.evaluate("() => (document.body ? document.body.innerText : '')")
        text = re.sub(r"[ \t]+", " ", text or "")
        text = re.sub(r"\n\s*\n\s*\n+", "\n\n", text).strip()
        return {"text": text[:READ_MAX_CHARS], "url": s.page.url, "truncated": len(text) > READ_MAX_CHARS}

    return await run_op(s, op, READ_TIMEOUT_MS / 1000)


@app.post("/click", dependencies=[Depends(auth)])
async def click(body: SelectorIn):
    sel = check_selector(body.selector)
    s = await require(body.session_id)

    async def op():
        await s.page.locator(sel).first.click(timeout=ACTION_TIMEOUT_MS)
        try:
            await s.page.wait_for_load_state("domcontentloaded", timeout=3_000)
        except Exception:
            pass
        return {"clicked": True, "url": s.page.url}

    return await run_op(s, op, ACTION_TIMEOUT_MS / 1000 + 4)


@app.post("/fill", dependencies=[Depends(auth)])
async def fill(body: FillIn):
    sel = check_selector(body.selector)
    s = await require(body.session_id)

    async def op():
        loc = s.page.locator(sel).first
        kind = (await loc.get_attribute("type", timeout=ACTION_TIMEOUT_MS) or "").lower()
        if kind == "password":
            raise HTTPException(400, "filling password fields is not allowed")
        await loc.fill(body.value, timeout=ACTION_TIMEOUT_MS)
        return {"filled": True}

    return await run_op(s, op, ACTION_TIMEOUT_MS * 2 / 1000 + 2)


@app.post("/extract", dependencies=[Depends(auth)])
async def extract(body: SelectorIn):
    sel = check_selector(body.selector)
    s = await require(body.session_id)

    async def op():
        # Fixed, caller-independent script; selector is passed as data, not code.
        items = await s.page.eval_on_selector_all(
            sel,
            """(els, max) => els.slice(0, max).map(e => {
                const o = { text: (e.innerText || e.textContent || '').trim() };
                const h = e.href || (e.querySelector && e.querySelector('a[href]') ? e.querySelector('a[href]').href : '');
                if (h) o.href = h;
                return o;
            })""",
            EXTRACT_MAX_ITEMS,
        )
        out = []
        for it in items[:EXTRACT_MAX_ITEMS]:
            o = {"text": (it.get("text") or "")[:EXTRACT_ITEM_CHARS]}
            href = it.get("href")
            if isinstance(href, str) and href.startswith(("http://", "https://")):
                o["href"] = href[:1000]
            out.append(o)
        return {"items": out}

    return await run_op(s, op, ACTION_TIMEOUT_MS / 1000)
