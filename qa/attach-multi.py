#!/usr/bin/env python3
"""Multi-attachment check: PNG + DOCX + XLSX via the file input -> 3 chips, image chip has a thumbnail,
and docx/xlsx text is extracted client-side. Usage: python3 qa/attach-multi.py [--base http://localhost:8765]"""
import sys, tempfile, os, struct, zlib
from playwright.sync_api import sync_playwright
base = sys.argv[sys.argv.index("--base") + 1] if "--base" in sys.argv else "http://localhost:8765"
d = tempfile.mkdtemp()
def png(path):
    raw = b"".join(b"\x00" + b"\xff\x00\x00" * 8 for _ in range(8))
    def ch(t, b): c = struct.pack(">I", len(b)) + t + b; return c + struct.pack(">I", zlib.crc32(t + b) & 0xffffffff)
    open(path, "wb").write(b"\x89PNG\r\n\x1a\n" + ch(b"IHDR", struct.pack(">IIBBBBB", 8, 8, 8, 2, 0, 0, 0)) + ch(b"IDAT", zlib.compress(raw)) + ch(b"IEND", b""))
import docx, openpyxl
p_png, p_docx, p_xlsx = (os.path.join(d, n) for n in ("pic.png", "memo.docx", "data.xlsx"))
png(p_png)
dc = docx.Document(); dc.add_paragraph("Hello DOCX marker"); t = dc.add_table(rows=1, cols=2); t.cell(0, 0).text = "CellA"; t.cell(0, 1).text = "CellB"; dc.save(p_docx)
wb = openpyxl.Workbook(); ws = wb.active; ws.title = "Sales"; ws.append(["Region", "Total"]); ws.append(["West", 42]); wb.save(p_xlsx)
fails = []
def check(c, m):
    print(("PASS " if c else "FAIL ") + m)
    if not c: fails.append(m)
# v158: sign in first — the instant auth gate overlays the page for signed-out visitors
import json, urllib.request
ANON = ("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJueGVybXlib2VpZ3Z3b25mcnp4Iiwi"
        "cm9sZSI6ImFub24iLCJpYXQiOjE3OTMyMTk5NTUsImV4cCI6MjEwODc5NTk1NX0.Xj3QP2IFsxzfFLJG8t6RpQlzLWFxpC6BcdGsXn-70CY")
_r = urllib.request.Request("https://bnxermyboeigvwonfrzx.supabase.co/auth/v1/token?grant_type=password",
    data=json.dumps({"email": "eval-bot@spaincos.com", "password": "EvalTest2026!"}).encode(),
    headers={"apikey": ANON, "content-type": "application/json"}, method="POST")
_m = json.loads(urllib.request.urlopen(_r, timeout=20).read())
_sess = {k: _m.get(k) for k in ("access_token", "refresh_token", "expires_in", "expires_at", "token_type")}
_sess["user"] = _m.get("user")

with sync_playwright() as pw:
    b = pw.chromium.launch(); pg = b.new_context(bypass_csp=True).new_page(); pg.goto(base, wait_until="domcontentloaded")
    pg.evaluate("s => localStorage.setItem('sb-bnxermyboeigvwonfrzx-auth-token', JSON.stringify(s))", _sess)
    pg.reload(wait_until="domcontentloaded")
    pg.wait_for_timeout(1500)
    pg.wait_for_function("typeof handleAttachFiles==='function'", timeout=15000)
    pg.set_input_files("input[type=file][accept*=docx]", [p_png, p_docx, p_xlsx])
    pg.wait_for_function("pendingAttachments.length===3", timeout=15000)
    chips = pg.locator("#landingAttachChip .attach-chip")
    check(chips.count() == 3, "3 chips render (got %d)" % chips.count())
    check(pg.locator("#landingAttachChip .attach-chip img.attach-thumb").count() == 1, "image chip has thumbnail")
    txt = pg.evaluate("pendingAttachments.map(a=>a.kind+':'+(a.content||''))")
    check(any("Hello DOCX marker" in t and "CellA" in t for t in txt), "docx text + table extracted")
    check(any("West" in t and "42" in t for t in txt), "xlsx rows extracted")
    pg.locator("#landingAttachChip .attach-chip button").first.click()
    check(pg.evaluate("pendingAttachments.length") == 2, "x removes one chip only")
    b.close()
sys.exit(1 if fails else 0)
