"""Stamp ?v=<content hash> on styles.css, script.js and figures.js links in every page,
so browsers fetch fresh copies after an update. Run before committing:
    python3 tools/bump_versions.py
"""
import glob
import hashlib
import os
import re

os.chdir(os.path.join(os.path.dirname(__file__), ".."))
ASSETS = ["styles.css", "script.js", "figures.js"]
ver = {a: hashlib.md5(open(a, "rb").read()).hexdigest()[:8] for a in ASSETS}

for page in glob.glob("*.html"):
    src = open(page).read()
    out = src
    for name, v in ver.items():
        out = re.sub(r'(href|src)="' + re.escape(name) + r'(\?v=[0-9a-f]+)?"', rf'\1="{name}?v={v}"', out)
    if out != src:
        open(page, "w").write(out)
        print("updated", page)
