"""
The site's security rules, checked in the source (docs/CLEANUP.md, part of `npm run tidy`). The site is static: there is
no server or database to break into, so what matters is that nothing a visitor types or links to can become markup,
and that no page loads code from someone else's server. The exit code is the number of findings.

    python scripts/audit-security.py
"""

import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RULES = [
    # (what it is, pattern, why it is refused)
    ("code from another site", r"<(script|iframe)[^>]*\bsrc=[\"']https?://|<link[^>]*\bhref=[\"']https?://[^\"']*\.(css|js)", "every script, frame and stylesheet is served by the site itself"),
    ("a request to another site", r"\b(fetch|XMLHttpRequest|WebSocket|sendBeacon|importScripts)\(\s*[\"'`]https?://", "the pages talk to no outside server"),
    ("running text as code", r"\beval\(|new Function\(|document\.write\(|setTimeout\(\s*[\"'`]", "text never becomes code"),
    ("React raw HTML", r"dangerouslySetInnerHTML", "React islands render text, never raw HTML"),
    ("a new tab that can reach back", r"target=\"_blank\"(?![^>]*noopener)", "outside links open with rel=\"noopener noreferrer\""),
    ("the address decoded into the page", r"decodeURIComponent\(location\.", "a malformed link throws here; compare the raw hash to known ids instead"),
]
# innerHTML is allowed only in these files, where every value written is the site's own data or passes through esc().
INNER_HTML_OK = {"src/components/IosTerminal.astro", "src/components/lifetime/LifetimeDay.astro"}

findings = 0
for folder, _, names in os.walk(os.path.join(ROOT, "src")):
    for name in names:
        if not name.endswith((".astro", ".ts", ".tsx", ".js", ".mjs")):
            continue
        path = os.path.join(folder, name)
        rel = os.path.relpath(path, ROOT).replace("\\", "/")
        with open(path, encoding="utf-8", errors="replace") as f:
            for n, line in enumerate(f, 1):
                for what, pattern, why in RULES:
                    if re.search(pattern, line):
                        print(f"  {rel}:{n}  {what}: {why}")
                        findings += 1
                if re.search(r"\.(innerHTML|outerHTML)\s*=|insertAdjacentHTML\(", line) and rel not in INNER_HTML_OK:
                    print(f"  {rel}:{n}  HTML written from script: use textContent, or escape and add the file to INNER_HTML_OK with the reason")
                    findings += 1

print(f"security: {findings} finding(s)")
sys.exit(min(findings, 100))
