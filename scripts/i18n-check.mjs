// Daftar kalimat t("...") di kode yang belum ada di kamus EN (src/lib/i18n/en.ts).
// Jalankan: npm run i18n:check   (keluar dengan kode 1 kalau ada yang kurang)
// Label yang diterjemahkan lewat variabel (t(a.label), t(CROWD[x].label), nama tag dari database)
// tidak terbaca skrip ini; kamus menyimpannya di bagian "Label dari data".
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../src", import.meta.url).pathname;
const files = [];
(function walk(d) {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(tsx?|mjs)$/.test(f)) files.push(p);
  }
})(root);

const dictSrc = readFileSync(join(root, "lib/i18n/en.ts"), "utf8");
const dict = new Set([...dictSrc.matchAll(/^\s*"((?:[^"\\]|\\.)*)":/gm)].map((m) => JSON.parse(`"${m[1]}"`)));

const missing = new Map();
for (const f of files) {
  if (f.includes("/admin/") || f.endsWith("i18n/en.ts")) continue;
  const s = readFileSync(f, "utf8");
  for (const m of s.matchAll(/\bt\("((?:[^"\\]|\\.)*)"/g)) {
    const key = JSON.parse(`"${m[1]}"`);
    if (!dict.has(key)) missing.set(key, f.replace(root, "src"));
  }
}
for (const [k, f] of missing) console.log(`${f}: ${JSON.stringify(k)}`);
console.log(`\n${missing.size} kalimat belum ada di kamus EN (${dict.size} sudah ada).`);
process.exit(missing.size ? 1 : 0);
