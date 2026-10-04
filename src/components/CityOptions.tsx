import { PROVINCES } from "@/lib/region";
import type { City } from "@/lib/types";

/** <option> kota dikelompokkan per provinsi (urut barat ke timur). valueKey: id atau slug. */
export default function CityOptions({ cities, valueKey = "id" }: { cities: City[]; valueKey?: "id" | "slug" }) {
  const order = (p: string) => { const i = (PROVINCES as readonly string[]).indexOf(p); return i < 0 ? 99 : i; };
  const groups = new Map<string, City[]>();
  for (const c of [...cities].sort((a, b) => order(a.province) - order(b.province) || a.name.localeCompare(b.name))) {
    const key = c.province || "Lainnya";
    groups.set(key, [...(groups.get(key) ?? []), c]);
  }
  if (groups.size <= 1) return <>{cities.map((c) => <option key={c.id} value={c[valueKey]}>{c.name}</option>)}</>;
  return (
    <>
      {[...groups].map(([prov, list]) => (
        <optgroup key={prov} label={prov}>
          {list.map((c) => <option key={c.id} value={c[valueKey]}>{c.name}</option>)}
        </optgroup>
      ))}
    </>
  );
}
