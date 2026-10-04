import Icon from "./Icon";
import { AMENITIES, filledAspects, hasAnyAmenity, levelOf, overallVerdict, type Amenities, type Scores } from "@/lib/review";

export function Stars({ value, className = "h-4 w-4" }: { value: number; className?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value.toFixed(1)} dari 5`}>
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.max(0, Math.min(1, value - i));
        return (
          <span key={i} className={`relative ${className}`}>
            <Icon name="star" filled className={`absolute inset-0 ${className} text-line`} />
            {fill > 0 && (
              <span className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                <Icon name="star" filled className={`${className} text-gold`} />
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}

export default function CafeScorecard({
  scores, amenities, overall, visitedAt,
}: { scores?: Scores | null; amenities?: Amenities | null; overall: number | null; visitedAt?: string | null }) {
  const aspects = filledAspects(scores);
  const showAmenities = hasAnyAmenity(amenities);
  if (!aspects.length && !showAmenities) return null;

  const visited = visitedAt ? new Date(visitedAt).toLocaleDateString("id-ID", { month: "long", year: "numeric" }) : null;

  return (
    <section className="mt-12" aria-labelledby="penilaian">
      <h2 id="penilaian" className="text-2xl font-bold">Cocok buat kerja?</h2>
      <p className="mt-1 text-sm text-muted">Aku nilai langsung saat duduk dan kerja di sini{visited ? `, terakhir ${visited}` : ""}.</p>

      {!!aspects.length && (
        <div className="mt-5 overflow-hidden rounded-3xl border border-line bg-surface">
          {overall != null && (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3 bg-brand-soft/60 px-5 py-5 md:px-7">
              <span className="font-display text-5xl font-extrabold leading-none tabular-nums text-brand">{overall.toFixed(1)}</span>
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-lg font-bold">{overallVerdict(overall)[0]}</span>
                  <Stars value={overall} className="h-[18px] w-[18px]" />
                </p>
                <p className="mt-0.5 text-sm text-muted">{overallVerdict(overall)[1]}</p>
              </div>
            </div>
          )}

          <ul className="grid px-5 sm:grid-cols-2 sm:gap-x-8 md:px-7">
            {aspects.map((a) => {
              const [label, desc] = levelOf(a, a.score);
              return (
                <li key={a.key} className="flex gap-3.5 border-b border-line py-4 last:border-b-0 sm:[&:nth-last-child(2):nth-child(odd)]:border-b-0">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
                    <Icon name={a.icon} className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className="font-sans text-[15px] font-semibold tracking-normal">{a.label}</h3>
                      <span className="text-sm font-bold tabular-nums">{a.score.toFixed(1)}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-tint" aria-hidden>
                      <div className="h-full rounded-full bg-gradient-to-r from-tan to-brand" style={{ width: `${(a.score / 5) * 100}%` }} />
                    </div>
                    <p className="mt-1.5 text-sm leading-snug">
                      <span className="font-semibold text-brand">{label}</span>
                      <span className="text-muted"> · {a.note ?? desc}</span>
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {showAmenities && (
        <div className="mt-8">
          <h3 className="font-sans text-lg font-bold tracking-normal">Fasilitas</h3>
          <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
            {AMENITIES.map((m) => {
              const v = amenities?.[m.key];
              const state = v === true ? "yes" : v === false ? "no" : "unknown";
              return (
                <li key={m.key} className={`flex items-center gap-2.5 text-sm ${state === "no" ? "text-muted" : ""}`}>
                  <span
                    title={state === "yes" ? "Ada" : state === "no" ? "Tidak ada" : "Belum aku cek"}
                    className={`grid h-5 w-5 shrink-0 place-items-center rounded-full ${
                      state === "yes" ? "bg-ok/15 text-ok" : state === "no" ? "bg-[#b4533a]/12 text-[#b4533a]" : "bg-gold/20 text-[#8a5a00]"
                    }`}
                  >
                    <Icon name={state === "yes" ? "check" : state === "no" ? "x" : "help"} className="h-3 w-3" />
                  </span>
                  <Icon name={m.icon} className="h-4 w-4 shrink-0 text-muted" />
                  <span className={state === "no" ? "line-through decoration-mist" : ""}>{m.label}</span>
                </li>
              );
            })}
          </ul>
          <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            <span className="flex items-center gap-1.5"><span className="grid h-3.5 w-3.5 place-items-center rounded-full bg-ok/15 text-ok"><Icon name="check" className="h-2.5 w-2.5" /></span>Ada</span>
            <span className="flex items-center gap-1.5"><span className="grid h-3.5 w-3.5 place-items-center rounded-full bg-[#b4533a]/12 text-[#b4533a]"><Icon name="x" className="h-2.5 w-2.5" /></span>Tidak ada</span>
            <span className="flex items-center gap-1.5"><span className="grid h-3.5 w-3.5 place-items-center rounded-full bg-gold/20 text-[#8a5a00]"><Icon name="help" className="h-2.5 w-2.5" /></span>Belum aku cek</span>
          </p>
        </div>
      )}
    </section>
  );
}
