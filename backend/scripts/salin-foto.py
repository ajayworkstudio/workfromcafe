#!/usr/bin/env python3
"""Salin foto dari Supabase Storage ke disk VPS, dengan susunan alamat yang sama.

Jalankan di VPS sebagai root: python3 salin-foto.py
Bisa diulang: hanya foto baru atau yang ukurannya berubah yang diunduh.
python3 salin-foto.py --cek: bandingkan isi 5 foto acak di Supabase dan di foto.wfchunters.com.

Alamat Supabase  https://<ref>.supabase.co/storage/v1/object/public/cafe-photos/<nama>
menjadi file      /var/lib/wfc/foto/storage/v1/object/public/cafe-photos/<nama>
dan disajikan di  https://foto.wfchunters.com/storage/v1/object/public/cafe-photos/<nama>
Saat pindah total, alamat foto di database cukup diganti bagian domainnya saja.

Daftar file dibaca dari database Supabase (alamatnya di /root/.wfc-supabase-url atau
SOURCE_DATABASE_URL), lalu file diunduh lewat alamat publik bucket.
"""
import concurrent.futures as cf
import os
import subprocess
import sys
import urllib.parse
import urllib.request

PUBLIC_BASE = os.environ.get("FOTO_SUMBER", "https://glsqzpuewndbupblmqzm.supabase.co/storage/v1/object/public")
DEST_ROOT = os.environ.get("FOTO_TUJUAN", "/var/lib/wfc/foto/storage/v1/object/public")
BUCKETS = ("cafe-photos",)
SECRET_FILE = "/root/.wfc-supabase-url"


def source_url():
    url = os.environ.get("SOURCE_DATABASE_URL")
    if not url and os.access(SECRET_FILE, os.R_OK):
        url = open(SECRET_FILE).read().strip()
    if not url:
        sys.exit(f"Isi SOURCE_DATABASE_URL atau simpan alamat Supabase di {SECRET_FILE}")
    return url


def list_objects(url):
    q = ("select bucket_id, name, coalesce(metadata->>'size', '-1') from storage.objects "
         f"where bucket_id in ({','.join(repr(b) for b in BUCKETS)}) order by name")
    out = subprocess.run(["psql", url, "-tAF", "\t", "-c", q], check=True, capture_output=True, text=True).stdout
    rows = []
    for line in out.splitlines():
        if line.strip():
            bucket, name, size = line.split("\t")
            rows.append((bucket, name, int(size)))
    return rows


def target_path(bucket, name):
    path = os.path.normpath(os.path.join(DEST_ROOT, bucket, name))
    if not path.startswith(os.path.join(DEST_ROOT, bucket) + os.sep):
        raise ValueError(f"nama file tidak aman: {name}")
    return path


def fetch(item):
    bucket, name, size = item
    try:
        path = target_path(bucket, name)
    except ValueError:
        return "gagal", f"{name} (nama tidak aman, dilewati)"
    if os.path.isfile(path) and os.path.getsize(path) == size:
        return "lewati", name
    os.makedirs(os.path.dirname(path), mode=0o755, exist_ok=True)
    url = f"{PUBLIC_BASE}/{bucket}/{urllib.parse.quote(name)}"
    tmp = path + ".unduh"
    for attempt in range(3):
        try:
            with urllib.request.urlopen(url, timeout=60) as r, open(tmp, "wb") as f:
                while chunk := r.read(1 << 16):
                    f.write(chunk)
            break
        except OSError:
            if attempt == 2:
                if os.path.exists(tmp):
                    os.remove(tmp)
                return "gagal", name
    got = os.path.getsize(tmp)
    if size >= 0 and got != size:
        os.remove(tmp)
        return "gagal", f"{name} (ukuran {got}, mau {size})"
    os.chmod(tmp, 0o644)
    os.replace(tmp, path)
    return "unduh", name


def check_served(items, n=5):
    """--cek: bandingkan isi beberapa foto acak dari Supabase dan dari foto.wfchunters.com."""
    import hashlib
    import random
    served = os.environ.get("FOTO_DOMAIN", "https://foto.wfchunters.com/storage/v1/object/public")
    sample = random.sample(items, min(n, len(items)))
    ok = True
    for bucket, name, _ in sample:
        path = f"{bucket}/{urllib.parse.quote(name)}"
        try:
            a = hashlib.sha256(urllib.request.urlopen(f"{PUBLIC_BASE}/{path}", timeout=60).read()).hexdigest()
            b = hashlib.sha256(urllib.request.urlopen(f"{served}/{path}", timeout=60).read()).hexdigest()
        except OSError as e:
            print(f"  GAGAL  {name}: {e}")
            ok = False
            continue
        print(f"  {'SAMA ' if a == b else 'BEDA '}  {name}")
        ok = ok and a == b
    print("Foto di domain baru sama persis dengan Supabase." if ok else "Ada foto yang berbeda atau gagal diambil.")
    sys.exit(0 if ok else 1)


def main():
    items = list_objects(source_url())
    if "--cek" in sys.argv:
        check_served(items)
    counts = {"unduh": 0, "lewati": 0, "gagal": 0}
    failed = []
    with cf.ThreadPoolExecutor(max_workers=6) as pool:
        for status, name in pool.map(fetch, items):
            counts[status] += 1
            if status == "gagal":
                failed.append(name)
    on_disk = sum(len(files) for _, _, files in os.walk(DEST_ROOT))
    total_mb = sum(os.path.getsize(os.path.join(d, f)) for d, _, fs in os.walk(DEST_ROOT) for f in fs) / 1048576
    print(f"Di Supabase: {len(items)} file")
    print(f"Diunduh: {counts['unduh']}, sudah ada: {counts['lewati']}, gagal: {counts['gagal']}")
    print(f"Di VPS: {on_disk} file, {total_mb:.1f} MB")
    for name in failed[:20]:
        print(f"  gagal: {name}")
    if failed or on_disk < len(items):
        sys.exit(1)
    print("Cocok: semua foto Supabase ada di VPS dengan ukuran yang sama.")


if __name__ == "__main__":
    main()
