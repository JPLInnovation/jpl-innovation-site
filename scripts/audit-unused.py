"""
What can be removed: source files nothing imports, and public files nothing references. Part of the cleanup pass
(docs/CLEANUP.md), run after every change:

    npm run tidy                      type check + tests + this audit
    python scripts/audit-unused.py    this audit alone (--list shows every unused public file)

It reads the tracked files only and matches by file name, so a file loaded through a name built in code looks unused:
list those folders in DYNAMIC below, with where the name is built. The exit code is the number of findings.
"""

import os
import re
import subprocess
import sys

# Folders whose files are loaded by names built at run time (so no source file spells them out).
DYNAMIC = {
    "public/assets/robot/": "the KitBot CAD parts, listed in manifest.json (src/lib/three/models/robot-exact.ts)",
    "public/studio/tex/": "`/studio/tex/${name}-${kind}.webp` (src/lib/studio/room.ts)",
    "public/assets/frc/w": "`w${week}-${n}` (src/components/frc-photos.tsx, counts in src/text/projects/frc.ts)",
}
# Routes and files a browser or host asks for by convention.
KEEP = {"favicon.png", "apple-touch-icon.png", "robots.txt", ".nojekyll", "CNAME"}

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
tracked = [t for t in subprocess.run(["git", "ls-files"], capture_output=True, text=True, encoding="utf-8").stdout.split("\n") if t]
TEXT = (".astro", ".ts", ".tsx", ".css", ".md", ".mjs", ".js", ".json", ".py", ".html", ".svg")
texts = {}
for t in tracked:
    if t.endswith(TEXT) and not t.startswith(("public/", "assets-src/")) and os.path.exists(t) and os.path.getsize(t) < 3_000_000:
        with open(t, encoding="utf-8", errors="replace") as f:
            texts[t] = f.read()
everything = "\n".join(texts.values())
findings = 0

print("Source files nothing imports:")
for t in tracked:
    if not t.startswith("src/") or not os.path.exists(t):
        continue
    if t.startswith("src/pages/") or t.endswith((".test.ts", ".d.ts", ".md")) or "content.config" in t:
        continue  # routes, tests, type shims and content are found by the framework, not imported
    stem = re.sub(r"\.(astro|tsx?|css|json|bin|svg|webp)$", "", os.path.basename(t))
    others = "\n".join(v for k, v in texts.items() if k != t)
    if not re.search(r"[/\"'@]" + re.escape(stem) + r"(\.(astro|tsx?|css|json|bin|svg|webp|js))?[\"'?]", others):
        print(f"  {t}  ({os.path.getsize(t) // 1024} KB)")
        findings += 1
if not findings:
    print("  none")

print("Public files nothing references:")
unused = []
for t in tracked:
    if not t.startswith("public/") or not os.path.exists(t):
        continue
    name = os.path.basename(t)
    if name in KEEP or any(t.startswith(prefix) for prefix in DYNAMIC):
        continue
    stem = re.sub(r"\.[a-z0-9]+$", "", name)
    core = re.sub(r"-(\d{3,4})$", "", stem)  # foo-800.webp is in use when "foo" is: the srcset is built in code
    if name in everything or stem in everything or (core != stem and core in everything):
        continue
    unused.append((os.path.getsize(t), t))
for size, t in sorted(unused, reverse=True)[: None if "--list" in sys.argv else 15]:
    print(f"  {size // 1024:6d} KB  {t}")
if len(unused) > 15 and "--list" not in sys.argv:
    print(f"  ... and {len(unused) - 15} more (--list shows all)")
if not unused:
    print("  none")
findings += len(unused)

print(f"{findings} finding(s), {sum(s for s, _ in unused) // 1024} KB of unused public files")
sys.exit(min(findings, 100))
