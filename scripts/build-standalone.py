#!/usr/bin/env python3
"""Inline CSS/JS/JSON into index-standalone.html for file:// opening."""
from pathlib import Path

root = Path(__file__).resolve().parent.parent
index = (root / "index.html").read_text(encoding="utf-8")
styles = (root / "styles.css").read_text(encoding="utf-8")
process_js = (root / "process.js").read_text(encoding="utf-8")
app_js = (root / "app.js").read_text(encoding="utf-8")
app_js = app_js.replace(
    "import { processTimeline, isVacation, roleMatrix, teamFull } from './process.js';\n",
    "",
)
timelines = (root / "timelines.json").read_text(encoding="utf-8")
data = (root / "data.json").read_text(encoding="utf-8")

index = index.replace(
    '<link rel="stylesheet" href="styles.css">',
    f"<style>\n{styles}\n</style>",
)
bundle = f"""<script type="module">
window.EMBEDDED_FILES = {{
  "timelines.json": {timelines},
  "data.json": {data}
}};
{process_js}
{app_js}
</script>"""
index = index.replace('<script type="module" src="app.js"></script>', bundle)

out = root / "index-standalone.html"
out.write_text(index, encoding="utf-8")
print(f"wrote {out}")
