#!/usr/bin/env bash
# fetch_md.sh - Convert any URL to clean Markdown
# Usage: bash fetch_md.sh <URL>
set -eu
URL="${1:?Usage: fetch_md.sh <URL>}"

# Fetch HTML content
CONTENT=$(curl -sL --max-time 15 --compressed \
  -H "User-Agent: Mozilla/5.0" \
  -H "Accept: text/html,application/xhtml+xml" \
  "$URL" 2>/dev/null || true)

if [ -z "$CONTENT" ]; then
  echo "[ERROR] Failed to fetch $URL"
  exit 1
fi

# Fallback chain
if command -v pandoc &>/dev/null; then
  echo "$CONTENT" | pandoc --to=markdown --wrap=none 2>/dev/null
elif command -v lynx &>/dev/null; then
  lynx -dump -nument "$URL" 2>/dev/null
elif command -v html2text &>/dev/null; then
  echo "$CONTENT" | html2text -nobs -width 80 2>/dev/null
else
  # Robust Python stdlib fallback using urllib + html.parser
  python3 - "$URL" << 'PYEOF'
import sys, urllib.request, re
from html.parser import HTMLParser

class MDParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.out = []
        self.skip = 0
        self.skip_tags = {'script', 'style', 'noscript', 'iframe'}
        self.headings = {'h1': '\n\n# ', 'h2': '\n\n## ', 'h3': '\n\n### ', 'h4': '\n\n#### '}

    def handle_starttag(self, tag, attrs):
        if tag in self.skip_tags: self.skip += 1
        if tag in self.headings:
            self.out.append(self.headings[tag])
        if tag == 'p':
            self.out.append('\n')
        if tag == 'br':
            self.out.append('\n')

    def handle_endtag(self, tag):
        if tag in self.skip_tags: self.skip -= 1
        if tag == 'ul' or tag == 'ol':
            self.out.append('\n')
        if tag == 'li':
            self.out.append(' - ')
            
    def handle_data(self, data):
        if self.skip == 0:
            self.out.append(data)

try:
    req = urllib.request.Request(sys.argv[1], headers={"User-Agent": "Mozilla/5.0", "Accept": "text/html"})
    with urllib.request.urlopen(req, timeout=15) as resp:
        html = resp.read().decode('utf-8', errors='ignore')
    
    p = MDParser()
    p.feed(html)
    txt = "".join(p.out)
    txt = re.sub(r'\s+', ' ', txt)
    txt = re.sub(r'\n{3,}', '\n\n', txt)
    txt = txt.strip()
    print(txt[:8000]) # Limit output size
except Exception as e:
    print(f"[ERROR] Fetch failed: {e}")
PYEOF
fi
