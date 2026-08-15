#!/usr/bin/env python3
"""Inline CSS/JS/JSON into index-standalone.html for file:// opening."""
from pathlib import Path
import json

root = Path(__file__).resolve().parent.parent
index = (root / "index.html").read_text(encoding="utf-8")
styles = (root / "styles.css").read_text(encoding="utf-8")
process_js = (root / "process.js").read_text(encoding="utf-8")
app_js = (root / "app.js").read_text(encoding="utf-8")
app_js = app_js.replace(
    "import { processTimeline, isVacation, roleMatrix, teamFull, weekCellLabel, rolePersonDays, formatMonthLabel, WORK_DAYS_PER_MONTH } from './process.js';\n",
    "",
)
catalog = json.loads((root / "timelines.json").read_text(encoding="utf-8"))
embedded = {"timelines.json": catalog}
for item in catalog.get("timelines", []):
    path = item.get("file")
    if path:
        embedded[path] = json.loads((root / path).read_text(encoding="utf-8"))

files_js = json.dumps(embedded, ensure_ascii=False)
index = index.replace(
    '<link rel="stylesheet" href="styles.css">',
    f"<style>\n{styles}\n</style>",
)
bundle = f"""<script type="module">
window.EMBEDDED_FILES = {files_js};
{process_js}
{app_js}
</script>"""
index = index.replace('<script type="module" src="app.js"></script>', bundle)

out = root / "index-standalone.html"
out.write_text(index, encoding="utf-8")
print(f"wrote {out}")
