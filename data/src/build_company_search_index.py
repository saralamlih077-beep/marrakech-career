"""Read public company homepages once to prepare the activity search index.

python data/src/build_company_search_index.py --source data/outputs/entreprises_import_supabase.csv
Only successful HTML responses are indexed; website text is data, never instructions.
"""
import argparse
import csv
import hashlib
import json
import re
import socket
import ipaddress
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FRONTEND = ROOT / "frontend" if (ROOT / "frontend/src").is_dir() else ROOT


def safe_url(value):
    value = (value or "").strip()
    if not value.lower().startswith(("https://", "http://")):
        value = "https://" + value
    url = urllib.parse.urlsplit(value)
    if url.scheme not in ("http", "https") or not url.hostname or url.username or url.password or url.port:
        raise ValueError("Not a public website")
    host = url.hostname.encode('idna').decode().lower()
    if "." not in host:
        raise ValueError("Not a public hostname")
    for address in socket.getaddrinfo(host, None):
        if not ipaddress.ip_address(address[4][0]).is_global:
            raise ValueError("Private destination")
    path = urllib.parse.quote(url.path or "/", safe="/%:@!$&'()*+,;=-._~")
    return urllib.parse.urlunsplit((url.scheme, host, path, "", ""))


class PublicRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, response, code, message, headers, new_url):
        return super().redirect_request(request, response, code, message, headers, safe_url(new_url))


class PageText(HTMLParser):
    skipped_tags = {"script", "style", "noscript", "svg", "nav", "footer", "form"}
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.skip = []
        self.title = []
        self.headings = []
        self.content = []
        self.descriptions = []
        self.in_title = False
        self.in_heading = False

    def handle_starttag(self, tag, attrs):
        if tag in self.skipped_tags:
            self.skip.append(tag)
        self.in_title = self.in_title or tag == "title"
        self.in_heading = self.in_heading or tag in {"h1", "h2", "h3"}
        if tag == "meta":
            values = dict(attrs)
            if (values.get("name") or values.get("property") or "").lower() in {"description", "og:description", "twitter:description"}:
                self.descriptions.append(values.get("content", ""))

    def handle_endtag(self, tag):
        if self.skip and tag == self.skip[-1]:
            self.skip.pop()
        if tag == "title":
            self.in_title = False
        if tag in {"h1", "h2", "h3"}:
            self.in_heading = False

    def handle_data(self, data):
        if self.skip:
            return
        value = re.sub(r"\s+", " ", data).strip()
        if not value:
            return
        if self.in_title:
            self.title.append(value)
        elif self.in_heading:
            self.headings.append(value)
        else:
            self.content.append(value)


def compact(values, limit):
    return " · ".join(dict.fromkeys(values))[:limit]


def collect(raw):
    try:
        source = safe_url(raw)
        opener = urllib.request.build_opener(PublicRedirect())
        request = urllib.request.Request(source, headers={"User-Agent": "MarrakechCareer-PublicActivityIndex/1.0"})
        with opener.open(request, timeout=10) as response:
            if "text/html" not in response.headers.get("Content-Type", ""):
                return source, None
            body = response.read(1_500_001)
            if len(body) > 1_500_000:
                return source, None
            html = body.decode(response.headers.get_content_charset() or "utf-8", errors="replace")
            final_url = safe_url(response.url)
        # A domain reseller/parking page describes a domain offer, not this company.
        if re.search(r"/(?:domain|domains|buy-domain|domain-for-sale)/", urllib.parse.urlsplit(final_url).path, re.I):
            return source, None
        parser = PageText()
        parser.feed(html)
        title = compact(parser.title, 300)
        if re.search(r"access denied|just a moment|403 forbidden|404 not found|attention required|site suspended|domain for sale", title, re.I):
            return source, None
        description = compact(parser.descriptions, 800)
        headings = compact(parser.headings, 1500)
        text = compact(parser.content, 7000)
        if len(description + headings + text) < 80:
            return source, None
        return source, {"title": title, "description": description, "headings": headings, "text": text, "sourceUrl": final_url}
    except Exception:
        return raw, None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    args = parser.parse_args()
    with args.source.open(encoding="utf-8-sig", newline="") as file:
        urls = sorted({row['site_web'] for row in csv.DictReader(file) if row.get('site_web')})
    pages = {}
    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = [pool.submit(collect, url) for url in urls]
        for index, future in enumerate(as_completed(futures), 1):
            url, page = future.result()
            if page:
                pages[url] = page
            if index % 25 == 0:
                print(json.dumps({"processed": index, "indexed": len(pages)}), flush=True)
    payload = json.dumps({"generatedAt": datetime.now(timezone.utc).isoformat(), "pages": dict(sorted(pages.items()))}, ensure_ascii=False, separators=(",", ":")).encode()
    fingerprint = hashlib.sha256(payload).hexdigest()[:12]
    folder = FRONTEND / 'public/company-search'
    folder.mkdir(parents=True, exist_ok=True)
    filename = f"activities-{fingerprint}.json"
    (folder / filename).write_bytes(payload)
    (FRONTEND / 'src/app/companySearchIndexInfo.json').write_text(json.dumps({"path": f"/company-search/{filename}", "sites": len(pages)}, indent=2) + "\n", encoding='utf-8')
    print(json.dumps({"public_sites": len(urls), "indexed": len(pages), "unavailable": len(urls) - len(pages), "bytes": len(payload)}), flush=True)


if __name__ == '__main__':
    main()
