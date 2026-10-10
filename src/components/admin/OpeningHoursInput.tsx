"use client";
import { useEffect, useState } from "react";
import type { DayKey, OpeningHours } from "@/lib/types";
import { DAYS } from "@/lib/utils";

type Mode = "hours" | "allday" | "closed";
type Row = { mode: Mode; open: string; close: string };

// Pilihan jam per 30 menit dalam format 24 jam (tanpa AM/PM)
const TIMES = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`);
const CLOSE_TIMES = [...TIMES.slice(1), "24:00"];

function initial(hours: OpeningHours | undefined, key: DayKey, isNew: boolean): Row {
  const slot = hours?.[key];
  if (isNew || slot === undefined) return { mode: "hours", open: "08:00", close: "22:00" };
  if (slot === null) return { mode: "closed", open: "08:00", close: "22:00" };
  if (slot[0] === "00:00" && (slot[1] === "24:00" || slot[1] === "23:59")) return { mode: "allday", open: "08:00", close: "22:00" };
  return { mode: "hours", open: slot[0], close: slot[1] };
}

export default function OpeningHoursInput({ hours, isNew }: { hours?: OpeningHours; isNew: boolean }) {
  const [rows, setRows] = useState<Record<DayKey, Row>>(
    () => Object.fromEntries(DAYS.map(({ key }) => [key, initial(hours, key, isNew)])) as Record<DayKey, Row>
  );
  // Pulihkan dari draf kafe baru (dikirim oleh CafeAutosave)
  useEffect(() => {
    const onRestore = (e: Event) => {
      const d = (e as CustomEvent<Record<string, string>>).detail ?? {};
      setRows((r) => Object.fromEntries(DAYS.map(({ key }) => {
        const v = d[`hours_${key}`];
        const m = v?.match(/^(\d{2}:\d{2})-(\d{2}:\d{2})$/);
        if (v === "closed") return [key, { ...r[key], mode: "closed" as Mode }];
        if (v === "00:00-24:00") return [key, { ...r[key], mode: "allday" as Mode }];
        if (m) return [key, { mode: "hours" as Mode, open: m[1], close: m[2] }];
        return [key, r[key]];
      })) as Record<DayKey, Row>);
    };
    window.addEventListener("cafe-draft-hours", onRestore);
    return () => window.removeEventListener("cafe-draft-hours", onRestore);
  }, []);
  const set = (key: DayKey, patch: Partial<Row>) => setRows((r) => ({ ...r, [key]: { ...r[key], ...patch } }));
  const copyMondayToAll = () => setRows((r) => Object.fromEntries(DAYS.map(({ key }) => [key, { ...r.mon }])) as Record<DayKey, Row>);
  const allDayEverywhere = () => setRows((r) => Object.fromEntries(DAYS.map(({ key }) => [key, { ...r[key], mode: "allday" as Mode }])) as Record<DayKey, Row>);

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        <button type="button" onClick={copyMondayToAll} className="btn-ghost !py-1.5 text-sm">Samakan semua hari dengan Senin</button>
        <button type="button" onClick={allDayEverywhere} className="btn-ghost !py-1.5 text-sm">Buka 24 jam setiap hari</button>
      </div>
      <div className="divide-y divide-line">
        {DAYS.map(({ key, label }) => {
          const r = rows[key];
          return (
            <div key={key} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
              <span className="w-16 text-sm font-medium">{label}</span>

              <div role="radiogroup" aria-label={`Status ${label}`} className="flex rounded-full bg-tint p-0.5 text-sm">
                {([["hours", "Jam tertentu"], ["allday", "24 jam"], ["closed", "Tutup"]] as [Mode, string][]).map(([m, text]) => (
                  <button key={m} type="button" role="radio" aria-checked={r.mode === m} onClick={() => set(key, { mode: m })}
                    className={`rounded-full px-3 py-1 font-medium transition-colors ${r.mode === m ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"}`}>
                    {text}
                  </button>
                ))}
              </div>

              {r.mode === "hours" && (
                <div className="flex items-center gap-2 text-sm">
                  <select aria-label={`${label} buka`} value={r.open} onChange={(e) => set(key, { open: e.target.value })} className="input !w-auto !py-1.5 tabular-nums">
                    {TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <span className="text-muted">sampai</span>
                  <select aria-label={`${label} tutup`} value={r.close} onChange={(e) => set(key, { close: e.target.value })} className="input !w-auto !py-1.5 tabular-nums">
                    {CLOSE_TIMES.map((t) => <option key={t} value={t}>{t === "24:00" ? "24:00 (tengah malam)" : t}</option>)}
                  </select>
                  {r.close <= r.open && r.close !== "24:00" && <span className="text-xs text-muted">lewat tengah malam</span>}
                </div>
              )}

              {/* Nilai yang dikirim ke server */}
              <input type="hidden" name={`hours_${key}`} value={r.mode === "closed" ? "closed" : r.mode === "allday" ? "00:00-24:00" : `${r.open}-${r.close}`} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
