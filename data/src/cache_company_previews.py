"""Prepare company website thumbnails for the frontend, outside user visits.

Run from the repository root with a company CSV export and Pillow installed:
python data/src/cache_company_previews.py --source data/outputs/entreprises_import_supabase.csv
Existing images are reused. New previews are attempted twice with four workers.
"""

import argparse
import csv
import hashlib
import io
import json
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
FRONTEND = ROOT / "frontend" if (ROOT / "frontend/src").is_dir() else ROOT
OUTPUT = FRONTEND / "public/company-previews"
MANIFEST = FRONTEND / "src/app/companyWebsitePreviews.json"


def save_manifest(manifest):
    temporary = MANIFEST.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(dict(sorted(manifest.items())), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(MANIFEST)


def public_website(value):
    value = (value or "").strip()
    if not value:
        return None
    if not value.lower().startswith(("https://", "http://")):
        value = "https://" + value
    try:
        url = urllib.parse.urlsplit(value)
        host = (url.hostname or "").lower()
        if (url.scheme not in ("http", "https") or url.username or url.password
                or url.port or "." not in host or ":" in host
                or all(part.isdigit() for part in host.split("."))
                or host.endswith((".localhost", ".local", ".internal", ".test", ".invalid"))):
            return None
        return urllib.parse.urlunsplit((url.scheme, url.netloc.lower(), url.path or "/", "", ""))
    except ValueError:
        return None


def prepare(url, attempt):
    endpoint = "https://s.wordpress.com/mshots/v1/" + urllib.parse.quote(url, safe="")
    endpoint += "?w=800&h=450" + (f"&retry={attempt}" if attempt else "")
    try:
        request = urllib.request.Request(endpoint, headers={"User-Agent": "MarrakechCareer-PreviewCache/1.0"})
        with urllib.request.urlopen(request, timeout=12) as response:
            if "/mshots/v1/default" in response.url:
                return url, None
            payload = response.read(3_000_001)
            if len(payload) > 3_000_000:
                return url, None
        with Image.open(io.BytesIO(payload)) as image:
            if image.width <= 400 or image.height <= 300:
                return url, None
            image = image.convert("RGB")
            image.thumbnail((640, 360))
            buffer = io.BytesIO()
            image.save(buffer, "WEBP", quality=78, method=4)
        encoded = buffer.getvalue()
        identity = hashlib.sha256(url.encode()).hexdigest()[:12]
        version = hashlib.sha256(encoded).hexdigest()[:10]
        filename = f"{identity}-{version}.webp"
        (OUTPUT / filename).write_bytes(encoded)
        return url, f"/company-previews/{filename}"
    except Exception:
        return url, None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    args = parser.parse_args()
    with args.source.open(encoding="utf-8-sig", newline="") as file:
        urls = sorted({url for row in csv.DictReader(file) if (url := public_website(row.get("site_web")))})
    OUTPUT.mkdir(parents=True, exist_ok=True)
    existing = json.loads(MANIFEST.read_text(encoding="utf-8")) if MANIFEST.exists() else {}
    manifest = {url: path for url, path in existing.items() if url in urls and (FRONTEND / "public" / path.lstrip("/")).is_file()}
    pending = [url for url in urls if url not in manifest]
    for attempt in range(2):
        if not pending:
            break
        print(json.dumps({"pass": attempt + 1, "pending": len(pending), "cached": len(manifest)}), flush=True)
        failed = []
        with ThreadPoolExecutor(max_workers=4) as pool:
            futures = [pool.submit(prepare, url, attempt) for url in pending]
            for index, future in enumerate(as_completed(futures), 1):
                url, path = future.result()
                if path:
                    manifest[url] = path
                else:
                    failed.append(url)
                if index % 25 == 0:
                    print(json.dumps({"processed": index, "cached": len(manifest)}), flush=True)
                    save_manifest(manifest)
        save_manifest(manifest)
        pending = failed
        if pending and attempt == 0:
            time.sleep(20)
    total_bytes = sum((FRONTEND / "public" / path.lstrip("/")).stat().st_size for path in manifest.values())
    print(json.dumps({"public_sites": len(urls), "cached": len(manifest), "unavailable": len(pending), "total_bytes": total_bytes}), flush=True)


if __name__ == "__main__":
    main()
