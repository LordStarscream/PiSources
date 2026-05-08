---
name: web-bash
description: Lightweight web search and content extraction using only bash. Converts web pages to clean Markdown for AI readability. Use for quick documentation lookups, fact checking, and simple web research without heavy dependencies.
---

# Web Bash

Minimal web access skill using bash only. Converts HTML to AI-friendly Markdown.

## Quick Reference

| Task | Command |
|------|---------|
| Search DuckDuckGo | `curl -sL "https://html.duckduckgo.com/html/?q=${QUERY}" \| grep -oP 'class="result__a"[^>]*href="\\K[^"]+' \| head -20` |
| Fetch as Markdown | See `./tools/fetch_md.sh <url>` |
| GitHub raw file | `curl -sL "https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}"` |
| Stack Overflow answer | `curl -sL "https://api.stackoverflow.com/2.3/search/advanced?q=${QUERY}&order=desc&sort=relevance&page=1&pagesize=5&site=stackoverflow&filter=withbody"` |
| Wikipedia extract | `curl -s "https://en.wikipedia.org/w/api.php?action=query&prop=extracts&format=json&origin=*&titles=${QUERY}&exintro=1" \| jq -r '.query.pages[0].extract' 2>/dev/null` |

## Tools

### `tools/fetch_md.sh`
Converts any URL to clean Markdown:
```bash
bash "$(dirname "$0")/tools/fetch_md.sh" <url>
```
Uses pandoc > lynx > grep fallback chain.

## When to Use

- Quick documentation lookups
- Code example searches
- Fact checking
- API reference lookups
- Stack Overflow debugging
- Wikipedia research
- When you need web content in Markdown format

## Tips

1. **DuckDuckGo** — Best for general web search, no API key needed
2. **Stack Overflow API** — Cleaner results than scraping, great for debugging
3. **GitHub raw** — Direct file access for reading repo source
4. **Wikipedia API** — Always returns clean JSON, great for quick fact lookups
5. **fetch_md.sh** — Fallback chain: pandoc → lynx → python stdlib → pure text
6. For large pages, pipe through `head -c 10000` to limit output

## Anti-Patterns

- Don't use curl for pages you can find via SO API or Wikipedia API
- Don't parse HTML manually — always use fetch_md.sh or the specialized APIs
- Don't forget `--compressed` flag when fetching gzip-encoded pages
- Don't skip User-Agent header — many sites block default curl UA
