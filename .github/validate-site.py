#!/usr/bin/env python3
"""Static validation for the marketing site. Fails loudly; zero dependencies."""
import re
import subprocess
import sys
from pathlib import Path

SITE = Path(__file__).resolve().parent.parent / 'site'
errors = []


def fail(msg):
    errors.append(msg)


html = (SITE / 'index.html').read_text()
css = (SITE / 'styles.css').read_text()
js = (SITE / 'site.js').read_text()

# 1. Single H1
if len(re.findall(r'<h1[ >]', html)) != 1:
    fail('expected exactly one <h1>')

# 2. Anchors resolve
ids = set(re.findall(r'id="([a-zA-Z-]+)"', html))
for target in set(re.findall(r'href="#([a-zA-Z-]+)"', html)):
    if target not in ids:
        fail(f'anchor #{target} has no matching id')

# 3. Local asset refs exist
for ref in sorted(set(re.findall(r'(?:src|href)="(assets/[^"]+|styles\.css|site\.js)"', html))):
    if not (SITE / ref).exists():
        fail(f'missing local asset: {ref}')

# 4. No external asset fetches (outbound <a> links are fine)
for m in re.findall(r'(?:src=|url\(|@import)[\"\(]*https?://[^")]+', html + css):
    fail(f'external asset fetch: {m}')

# 5. No emoji (house rule)
if re.search(r'[\U0001F300-\U0001FAFF\u2600-\u27BF]', html):
    fail('emoji found in index.html')

# 6. JS parses
proc = subprocess.run(['node', '--check', str(SITE / 'site.js')], capture_output=True, text=True)
if proc.returncode != 0:
    fail(f'site.js syntax: {proc.stderr.strip()[:200]}')

# 7. CSS braces balance
depth = 0
for ch in css:
    depth += (ch == '{') - (ch == '}')
if depth != 0:
    fail('styles.css braces unbalanced')

if errors:
    print('SITE VALIDATION FAILED:')
    for e in errors:
        print(f'  - {e}')
    sys.exit(1)
print('site validation OK')
