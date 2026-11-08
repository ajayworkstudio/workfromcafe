#!/usr/bin/env python3
"""Bandingkan data publik dari Supabase dengan API Go, field demi field.

Jalankan di VPS: python3 banding-supabase.py
Opsional: API_URL (default https://api.wfchunters.com)

Kunci di bawah adalah kunci publik Supabase (publishable), sama dengan yang tertanam di situs.
Ia hanya bisa membaca data yang memang terbuka untuk pengunjung tanpa login.
Perbedaan bisa juga muncul karena data di VPS adalah salinan sesaat; salin ulang dengan RESET=1
lalu jalankan skrip ini lagi kalau perlu.
"""
import json
import os
import sys
import urllib.parse
import urllib.request

SUPABASE_URL = "https://glsqzpuewndbupblmqzm.supabase.co/rest/v1"
SUPABASE_KEY = "sb_publishable_GcipOOLaQbKdTWQUTYZdFg_CeCdI4jd"
API_URL = os.environ.get("API_URL", "https://api.wfchunters.com").rstrip("/")
CAFE_SELECT = "*,city:cities(*),photos:cafe_photos(*),tags:cafe_tags(tag:tags(*))"


def fetch(url, headers=None):
    req = urllib.request.Request(url, headers=headers or {})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def supa(path, **params):
    qs = urllib.parse.urlencode(params, safe="*,():.")
    return fetch(f"{SUPABASE_URL}/{path}?{qs}", {"apikey": SUPABASE_KEY})


def api(path):
    return fetch(f"{API_URL}{path}")


def norm(v):
    """Urutkan daftar di dalamnya supaya urutan embed (foto, tag) tidak dianggap beda."""
    if isinstance(v, dict):
        return {k: norm(x) for k, x in v.items()}
    if isinstance(v, list):
        items = [norm(x) for x in v]
        return sorted(items, key=lambda x: json.dumps(x, sort_keys=True))
    if isinstance(v, float) and v.is_integer():
        return int(v)
    return v


def diff(a, b, path=""):
    """Daftar perbedaan antara a (Supabase) dan b (Go)."""
    out = []
    if isinstance(a, dict) and isinstance(b, dict):
        for k in sorted(set(a) | set(b)):
            if k not in b:
                out.append(f"{path}.{k}: hanya ada di Supabase")
            elif k not in a:
                out.append(f"{path}.{k}: hanya ada di Go")
            else:
                out += diff(a[k], b[k], f"{path}.{k}")
    elif isinstance(a, list) and isinstance(b, list) and len(a) == len(b):
        for i, (x, y) in enumerate(zip(a, b)):
            out += diff(x, y, f"{path}[{i}]")
    elif a != b:
        sa, sb = json.dumps(a, ensure_ascii=False), json.dumps(b, ensure_ascii=False)
        out.append(f"{path}: Supabase={sa[:80]} | Go={sb[:80]}")
    return out


def by_id(rows):
    return {r["id"]: norm(r) for r in rows}


problems = 0


def report(name, issues):
    global problems
    if issues:
        problems += len(issues)
        print(f"BEDA  {name}")
        for i in issues[:10]:
            print(f"      {i}")
        if len(issues) > 10:
            print(f"      ... dan {len(issues) - 10} lagi")
    else:
        print(f"SAMA  {name}")


def compare_rows(name, a_rows, b_rows):
    a, b = by_id(a_rows), by_id(b_rows)
    issues = [f"{k}: hanya ada di Supabase" for k in a.keys() - b.keys()]
    issues += [f"{k}: hanya ada di Go" for k in b.keys() - a.keys()]
    for k in a.keys() & b.keys():
        issues += [f"{k}{d}" for d in diff(a[k], b[k])]
    report(f"{name} ({len(a_rows)} di Supabase, {len(b_rows)} di Go)", issues)


def main():
    compare_rows("kota", supa("cities", select="*", is_active="eq.true", order="name"), api("/v1/cities"))
    compare_rows("tag", supa("tags", select="*", order="name"), api("/v1/tags"))

    s_cafes = supa("cafes", select=CAFE_SELECT, order="my_rating.desc.nullslast")
    g_cafes = api("/v1/cafes")
    compare_rows("daftar kafe", s_cafes, g_cafes)

    # Urutan peringkat: kafe dengan my_rating berbeda harus berurutan sama
    rank = lambda rows: [r["my_rating"] for r in rows]  # noqa: E731
    report("urutan rating daftar kafe", [] if rank(s_cafes) == rank(g_cafes) else ["urutan my_rating berbeda"])

    for kota in ["semarang", "yogyakarta"]:
        cid = next((c["id"] for c in supa("cities", select="id", slug=f"eq.{kota}")), None)
        if cid:
            compare_rows(f"kafe di {kota}", supa("cafes", select=CAFE_SELECT, city_id=f"eq.{cid}"), api(f"/v1/cafes?kota={kota}"))

    detail_issues = []
    for c in s_cafes:
        g = api(f"/v1/cafes/{urllib.parse.quote(c['slug'])}")
        s_det = supa("cafe_details", select="*", cafe_id=f"eq.{c['id']}")
        s_menu = supa("menu_items", select="*", cafe_id=f"eq.{c['id']}", order="sort_order")
        detail_issues += [f"{c['slug']} cafe{d}" for d in diff(norm(c), norm(g["cafe"]))]
        detail_issues += [f"{c['slug']} details{d}" for d in diff(norm(s_det[0] if s_det else None), norm(g["details"]))]
        detail_issues += [f"{c['slug']} menu{d}" for d in diff(norm(s_menu), norm(g["menu"]))]
    report(f"detail, ulasan, dan menu ({len(s_cafes)} kafe)", detail_issues)

    print()
    print("Semua cocok." if problems == 0 else f"Ada {problems} perbedaan.")
    sys.exit(1 if problems else 0)


if __name__ == "__main__":
    main()
