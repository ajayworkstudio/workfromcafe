import Icon from "@/components/Icon";
import { AMENITIES, ASPECTS, cleanScore, type Amenities, type Scores } from "@/lib/review";

const SCORE_OPTIONS = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];

/** Isian nilai 1–5 + catatan per aspek. Nama field: score_<aspek>, note_<aspek>. */
export function ScoreFields({ scores }: { scores?: Scores | null }) {
  return (
    <div className="divide-y divide-line">
      {ASPECTS.map((a) => {
        const v = cleanScore(scores?.[a.key]);
        return (
          <div key={a.key} className="grid gap-2 py-3 first:pt-0 last:pb-0 sm:grid-cols-[190px_150px_1fr] sm:items-center sm:gap-3">
            <label htmlFor={`score_${a.key}`} className="flex items-center gap-2.5 text-sm font-semibold">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-soft text-brand"><Icon name={a.icon} className="h-4 w-4" /></span>
              {a.label}
            </label>
            <select id={`score_${a.key}`} name={`score_${a.key}`} defaultValue={v ?? ""} className="input !py-2">
              <option value="">Belum dinilai</option>
              {SCORE_OPTIONS.map((n) => <option key={n} value={n}>{n.toString().replace(".", ",")}</option>)}
            </select>
            <input name={`note_${a.key}`} defaultValue={scores?.notes?.[a.key] ?? ""} aria-label={`Catatan ${a.label}`}
              placeholder={a.levels[3][1]} maxLength={90} className="input !py-2" />
          </div>
        );
      })}
    </div>
  );
}

/** Pilihan Ada / Tidak / ? per fasilitas. Nama field: amenity_<kunci> bernilai "ya" | "tidak" | "". */
export function AmenityFields({ amenities }: { amenities?: Amenities | null }) {
  return (
    <div className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
      {AMENITIES.map((m) => {
        const v = amenities?.[m.key];
        const cur = v === true ? "ya" : v === false ? "tidak" : "";
        return (
          <fieldset key={m.key} className="flex items-center justify-between gap-3">
            <legend className="sr-only">{m.label}</legend>
            <span className="flex items-center gap-2 text-sm"><Icon name={m.icon} className="h-4 w-4 text-muted" />{m.label}</span>
            <span className="flex shrink-0 overflow-hidden rounded-lg border border-line text-xs font-semibold">
              {[["ya", "Ada"], ["tidak", "Tidak"], ["", "?"]].map(([val, lbl]) => (
                <label key={val} className="cursor-pointer border-l border-line first:border-l-0">
                  <input type="radio" name={`amenity_${m.key}`} value={val} defaultChecked={cur === val} className="peer sr-only" />
                  <span className={`block px-2.5 py-1.5 peer-focus-visible:ring-2 peer-focus-visible:ring-brand ${
                    val === "ya" ? "peer-checked:bg-ok peer-checked:text-white" : val === "tidak" ? "peer-checked:bg-[#b4533a] peer-checked:text-white" : "peer-checked:bg-tint"
                  }`}>{lbl}</span>
                </label>
              ))}
            </span>
          </fieldset>
        );
      })}
    </div>
  );
}
