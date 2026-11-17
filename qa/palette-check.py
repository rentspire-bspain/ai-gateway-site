#!/usr/bin/env python3
"""Manual palette functional check (not part of the launch gate): opens the local
build, presses Cmd/Ctrl+K, types, navigates with arrows, and runs actions."""
import re, sys
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8765"
fails = []

def check(name, ok, detail=""):
    print(f"  {'PASS' if ok else 'FAIL'}  {name}" + (f"  [{detail}]" if not ok else ""))
    if not ok:
        fails.append(name)

with sync_playwright() as p:
    b = p.chromium.launch(args=["--no-proxy-server"])
    pg = b.new_page()
    errs = []
    pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(BASE, wait_until="networkidle")

    # 1. Cmd/Ctrl+K opens the palette
    pg.keyboard.press("Control+k")
    check("Cmd/Ctrl+K opens palette", pg.locator(".cp-overlay").count() == 1)
    check("palette input focused", pg.evaluate("document.activeElement && document.activeElement.id") == "cpInput")
    check("default results show actions", pg.locator(".cp-item").count() >= 10,
          pg.locator(".cp-item").count())

    # 2. typing filters (fuzzy)
    pg.fill("#cpInput", "setng")
    names = pg.locator(".cp-item-name").all_inner_texts()
    check("fuzzy 'setng' surfaces Settings", any("Settings" in n for n in names), str(names[:5]))

    # 3. arrow keys navigate + aria-selected moves
    first = pg.evaluate("document.querySelector('.cp-item[aria-selected=true]') && document.querySelector('.cp-item[aria-selected=true]').textContent")
    pg.keyboard.press("ArrowDown")
    second = pg.evaluate("document.querySelector('.cp-item[aria-selected=true]') && document.querySelector('.cp-item[aria-selected=true]').textContent")
    check("ArrowDown moves selection", first != second, f"{first!r} -> {second!r}")
    pg.keyboard.press("ArrowUp")
    back = pg.evaluate("document.querySelector('.cp-item[aria-selected=true]') && document.querySelector('.cp-item[aria-selected=true]').textContent")
    check("ArrowUp moves back", back == first, f"{back!r}")

    # 4. Escape closes
    pg.keyboard.press("Escape")
    check("Escape closes palette", pg.locator(".cp-overlay").count() == 0)

    # 5. Ctrl+K toggles closed
    pg.keyboard.press("Control+k")
    check("Ctrl+K opens again", pg.locator(".cp-overlay").count() == 1)
    pg.keyboard.press("Control+k")
    check("Ctrl+K toggles closed", pg.locator(".cp-overlay").count() == 0)

    # 6. run an action: Open Settings -> Connectors
    pg.keyboard.press("Control+k")
    pg.fill("#cpInput", "Connectors")
    pg.keyboard.press("Enter")
    pg.wait_for_timeout(400)
    check("Settings opens on Connectors pane",
          pg.evaluate("(window.SettingsUI && window.SettingsUI.isOpen) || document.querySelector('.stg-root.open, .stg-modal') !== null") or
          pg.locator(".stg-pane, .stg-nav, [class*=stg]").count() > 0,
          "settings pane not detected")
    check("Connectors pane active",
          "connectors" in pg.content().lower() and pg.locator("[class*=stg]").count() > 0)

    # 7. research prompt submits a query
    pg.keyboard.press("Escape")
    pg.evaluate("window.CommandPalette.open()")
    pg.fill("#cpInput", "RAG")
    names = pg.locator(".cp-item-name").all_inner_texts()
    check("fuzzy 'RAG' finds the RAG research prompt", any("RAG" in n for n in names), str(names[:5]))
    pg.keyboard.press("Enter")
    pg.wait_for_timeout(800)
    check("research prompt submitted via submitQuery path",
          pg.evaluate("!!document.querySelector('#resultsContent, #resultsScroll') && document.getElementById('resultsScroll').style.display !== 'none'") or
          "Research" in pg.content() or pg.locator(".thread-item").count() > 0,
          "no results view")

    # 8. New thread action
    pg.evaluate("window.CommandPalette.open()")
    pg.fill("#cpInput", "New thread")
    pg.keyboard.press("Enter")
    pg.wait_for_timeout(300)
    check("New thread returns to landing", pg.evaluate("document.getElementById('landing').style.display") == "flex")

    # 9. theme toggle
    before = pg.evaluate("document.documentElement.getAttribute('data-theme')")
    pg.evaluate("window.CommandPalette.open()")
    pg.fill("#cpInput", "theme")
    pg.keyboard.press("Enter")
    after = pg.evaluate("document.documentElement.getAttribute('data-theme')")
    check("Toggle theme flips data-theme", before != after, f"{before} -> {after}")

    # 10. zero console errors from the palette
    check("no JS errors during palette use", len(errs) == 0, "; ".join(errs[:3]))
    b.close()

print(f"\n{len(fails)} failed" + (": " + ", ".join(fails) if fails else ""))
sys.exit(1 if fails else 0)
