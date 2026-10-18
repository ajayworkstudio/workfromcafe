"use client";
import { useCallback, useEffect, useId, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Icon from "./Icon";
import { submitReport } from "@/app/kafe/[slug]/reports";
import { PLUGS, REPORT_RADIUS_M, distanceM, wifiVerdict } from "@/lib/reports";
import { onCellular, runSpeedTest, type SpeedPhase, type SpeedResult } from "@/lib/speedTest";

type Props = {
  cafeId: string; slug: string; cafeName: string; loggedIn: boolean;
  lat: number | null; lng: number | null;
  label: string; className?: string;
};

type Loc =
  | { state: "idle" | "checking" | "denied" | "unavailable" }
  | { state: "near" | "far"; lat: number; lng: number; accuracy: number; distance: number };

const CROWD_OPTS = [
  { v: 1, label: "Sepi", icon: "user" },
  { v: 2, label: "Sedang", icon: "users" },
  { v: 3, label: "Ramai", icon: "users" },
] as const;

const fmtDist = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1).replace(".", ",")} km` : `${Math.round(m)} m`);

/** Tombol "Lapor kondisi" + lembar 2 langkah: keramaian & colokan, lalu tes wifi dan kirim. */
export default function ReportSheet({ cafeId, slug, cafeName, loggedIn, lat, lng, label, className }: Props) {
  const router = useRouter();
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [crowd, setCrowd] = useState<number | null>(null);
  const [plugs, setPlugs] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [loc, setLoc] = useState<Loc>({ state: "idle" });
  const [phase, setPhase] = useState<SpeedPhase | "idle" | "error">("idle");
  const [live, setLive] = useState(0);
  const [result, setResult] = useState<SpeedResult | null>(null);
  const [cellular, setCellular] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const abort = useRef<AbortController | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const hasCoords = lat != null && lng != null;

  const checkLocation = useCallback(() => {
    if (!hasCoords) return;
    if (!navigator.geolocation) { setLoc({ state: "unavailable" }); return; }
    setLoc({ state: "checking" });
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const d = distanceM({ lat: p.coords.latitude, lng: p.coords.longitude }, { lat: lat!, lng: lng! });
        const slack = Math.min(p.coords.accuracy || 0, 200);
        setLoc({ state: d - slack <= REPORT_RADIUS_M ? "near" : "far", lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, distance: d });
      },
      (e) => setLoc({ state: e.code === e.PERMISSION_DENIED ? "denied" : "unavailable" }),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  }, [hasCoords, lat, lng]);

  const close = useCallback(() => {
    abort.current?.abort();
    setOpen(false);
    trigger.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = ""; document.removeEventListener("keydown", onKey); };
  }, [open, close]);

  function openSheet() {
    setStep(1); setCrowd(null); setPlugs(null); setNote(""); setError(null);
    setPhase("idle"); setResult(null); setLive(0);
    setOpen(true);
    checkLocation();
  }

  async function startTest() {
    setError(null); setResult(null); setLive(0);
    setCellular(onCellular());
    abort.current?.abort();
    const ac = new AbortController();
    abort.current = ac;
    try {
      const r = await runSpeedTest(ac.signal, (p, m) => { setPhase(p); if (m != null) setLive(m); });
      setResult(r);
    } catch {
      if (!ac.signal.aborted) setPhase("error");
    }
  }

  function send(withTest: boolean) {
    setError(null);
    start(async () => {
      const r = await submitReport({
        cafeId, slug, crowd: crowd!, plugs, note,
        download: withTest ? result?.download ?? null : null,
        upload: withTest ? result?.upload ?? null : null,
        ping: withTest ? result?.ping ?? null : null,
        lat: "lat" in loc ? loc.lat : null, lng: "lng" in loc ? loc.lng : null, accuracy: "accuracy" in loc ? loc.accuracy : null,
      });
      if (!r.ok) { setError(r.error); return; }
      setStep(3);
      router.refresh();
    });
  }

  if (!loggedIn) {
    return (
      <Link href={`/masuk?next=/kafe/${slug}`} className={className}>
        <Icon name="pin" className="h-[18px] w-[18px]" />{label}
      </Link>
    );
  }

  const locBlocked = hasCoords && loc.state !== "near";
  const testing = phase === "ping" || phase === "download" || phase === "upload";
  const shown = result?.download ?? live;
  const gauge = Math.min(shown / 100, 1); // busur penuh = 100 Mbps

  return (
    <>
      <button ref={trigger} type="button" onClick={openSheet} className={className}>
        <Icon name="pin" className="h-[18px] w-[18px]" />{label}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6">
          <button type="button" aria-label="Tutup" onClick={close} className="absolute inset-0 cursor-default bg-ink/55" />
          <div ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId}
            className="relative flex max-h-[92dvh] w-full flex-col overflow-y-auto rounded-t-[2rem] bg-canvas px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-3 outline-none md:max-w-md md:rounded-[2rem] md:pb-6">
            <span className="mx-auto mb-4 block h-1 w-10 shrink-0 rounded-full bg-line md:hidden" aria-hidden />

            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                {step < 3 && <p className="truncate text-xs font-semibold text-muted">Langkah {step} dari 2 · {cafeName}</p>}
                <h2 id={titleId} className="mt-0.5 text-[1.375rem] font-extrabold leading-tight">
                  {step === 1 ? "Gimana kondisinya sekarang?" : step === 2 ? "Tes wifi kafe" : "Makasih, laporanmu tayang"}
                </h2>
                {step === 2 && <p className="mt-1 text-sm text-muted">Pastikan HP tersambung ke wifi kafe, bukan data seluler.</p>}
              </div>
              <button type="button" onClick={step === 2 && !testing ? () => setStep(1) : close} aria-label={step === 2 && !testing ? "Kembali ke langkah 1" : "Tutup"}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-line bg-surface">
                <Icon name={step === 2 && !testing ? "back" : "x"} className="h-[18px] w-[18px]" />
              </button>
            </div>

            {step === 1 && (
              <div className="mt-5 space-y-5">
                {hasCoords && (
                  <div role="status" className={`flex items-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-semibold ${
                    loc.state === "near" ? "bg-[#eef6f1] text-[#2f7049]" : loc.state === "checking" || loc.state === "idle" ? "bg-tint text-muted" : "bg-[#b4533a]/10 text-[#8c3b25]"
                  }`}>
                    <Icon name="pin" className="h-[18px] w-[18px] shrink-0" />
                    <span className="min-w-0 flex-1">
                      {loc.state === "near" && "Kamu terdeteksi di dekat kafe ini"}
                      {(loc.state === "checking" || loc.state === "idle") && "Mengecek lokasimu…"}
                      {loc.state === "far" && `Kamu sekitar ${fmtDist(loc.distance)} dari kafe. Laporan hanya bisa dari dekat kafe.`}
                      {loc.state === "denied" && "Izinkan akses lokasi di browser supaya bisa melapor."}
                      {loc.state === "unavailable" && "Lokasi belum terbaca. Coba lagi di dekat jendela atau nyalakan GPS."}
                    </span>
                    {(loc.state === "far" || loc.state === "denied" || loc.state === "unavailable") && (
                      <button type="button" onClick={checkLocation} className="min-h-11 shrink-0 rounded-full px-2 underline">Cek lagi</button>
                    )}
                  </div>
                )}

                <fieldset>
                  <legend className="mb-2.5 font-bold">Seramai apa?</legend>
                  <div className="grid grid-cols-3 gap-2">
                    {CROWD_OPTS.map((o) => {
                      const on = crowd === o.v;
                      return (
                        <button key={o.v} type="button" aria-pressed={on} onClick={() => setCrowd(o.v)}
                          className={`flex h-24 flex-col items-center justify-center gap-2 rounded-[1.25rem] text-sm font-bold transition-colors ${
                            on ? o.v === 1 ? "border-2 border-[#2f7049] bg-[#eef6f1] text-[#2f7049]" : o.v === 2 ? "border-2 border-[#8a5a00] bg-gold/15 text-[#8a5a00]" : "border-2 border-[#8c3b25] bg-[#b4533a]/10 text-[#8c3b25]"
                              : "border border-line bg-surface hover:border-mist"
                          }`}>
                          <span className="flex">{Array.from({ length: o.v }).map((_, i) => <Icon key={i} name="user" className={`h-6 w-6 ${i ? "-ml-2.5" : ""}`} />)}</span>
                          {o.label}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="mb-2.5 font-bold">Colokan <span className="font-medium text-muted">(opsional)</span></legend>
                  <div className="flex flex-wrap gap-2">
                    {([1, 2, 3] as const).map((v) => (
                      <button key={v} type="button" aria-pressed={plugs === v} onClick={() => setPlugs(plugs === v ? null : v)}
                        className={`min-h-11 rounded-full px-4 text-sm font-semibold ${plugs === v ? "bg-ink text-white" : "border border-line bg-surface"}`}>
                        {PLUGS[v]}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <div>
                  <label htmlFor={`${titleId}-note`} className="mb-2 block font-bold">Catatan singkat <span className="font-medium text-muted">(opsional)</span></label>
                  <input id={`${titleId}-note`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={140}
                    placeholder="Mis. lantai 2 sepi, AC dingin" className="input min-h-12" />
                </div>

                <button type="button" disabled={!crowd || locBlocked} onClick={() => { setStep(2); startTest(); }}
                  className="btn-primary min-h-[3.25rem] w-full disabled:opacity-50">
                  Lanjut: tes wifi <Icon name="arrow" className="h-[18px] w-[18px]" />
                </button>
                {!crowd && !locBlocked && <p className="-mt-3 text-center text-xs text-muted">Pilih seramai apa dulu.</p>}
              </div>
            )}

            {step === 2 && (
              <div className="mt-5 space-y-4">
                <div className="flex flex-col items-center gap-3 rounded-[1.75rem] border border-line bg-surface px-4 pb-4 pt-5">
                  <div className="relative h-[120px] w-[210px]">
                    <svg viewBox="0 0 210 120" className="h-full w-full" aria-hidden>
                      <path d="M15 110 A90 90 0 0 1 195 110" fill="none" stroke="#efe7e1" strokeWidth="16" strokeLinecap="round" />
                      <path d="M15 110 A90 90 0 0 1 195 110" fill="none" stroke="#6b4226" strokeWidth="16" strokeLinecap="round"
                        pathLength={100} strokeDasharray={`${gauge * 100} 100`} className="transition-[stroke-dasharray] duration-300" />
                    </svg>
                    <div className="absolute inset-x-0 bottom-0 flex flex-col items-center" aria-live="polite">
                      <span className="text-[2.5rem] font-extrabold leading-none tabular-nums">{phase === "ping" ? "…" : Math.round(shown)}</span>
                      <span className="text-sm font-semibold text-muted">
                        {phase === "ping" ? "Mengukur jeda" : phase === "upload" ? "Mbps unduh · mengukur unggah" : "Mbps unduh"}
                      </span>
                    </div>
                  </div>

                  {result && (
                    <>
                      <div className="grid w-full grid-cols-2 gap-2">
                        <div className="rounded-2xl bg-canvas px-3 py-2.5"><p className="text-xs text-muted">Unggah</p><p className="font-extrabold">{result.upload != null ? `${Math.round(result.upload)} Mbps` : "-"}</p></div>
                        <div className="rounded-2xl bg-canvas px-3 py-2.5"><p className="text-xs text-muted">Jeda (ping)</p><p className="font-extrabold">{result.ping} ms</p></div>
                      </div>
                      <p className={`flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-semibold ${result.download >= 8 ? "bg-[#eef6f1] text-[#2f7049]" : "bg-gold/15 text-[#8a5a00]"}`}>
                        <Icon name="check" className="h-[18px] w-[18px]" />{wifiVerdict(result.download)}
                      </p>
                    </>
                  )}
                  {phase === "error" && <p role="alert" className="w-full rounded-2xl bg-[#b4533a]/10 px-3 py-2.5 text-sm text-[#8c3b25]">Tes wifi gagal. Coba tes ulang, atau kirim laporan tanpa tes.</p>}
                </div>

                {cellular && <p className="rounded-2xl bg-gold/15 px-3 py-2.5 text-sm text-[#8a5a00]">HP-mu sepertinya memakai data seluler. Sambungkan ke wifi kafe lalu tes ulang supaya hasilnya benar.</p>}
                <p className="text-xs text-muted">Tes memakai sekitar 10 MB data dan selesai dalam beberapa detik.</p>

                {error && <p role="alert" className="rounded-2xl bg-[#b4533a]/10 px-3 py-2.5 text-sm text-[#8c3b25]">{error}</p>}

                <div className="space-y-2.5 pt-1">
                  <button type="button" disabled={!result || pending || cellular} onClick={() => send(true)} className="btn-primary min-h-[3.25rem] w-full disabled:opacity-50">
                    {pending ? "Mengirim…" : testing ? "Sedang tes…" : "Kirim laporan"}
                  </button>
                  <div className="flex gap-2.5">
                    <button type="button" disabled={testing || pending} onClick={startTest} className="btn-ghost min-h-12 flex-1 disabled:opacity-50">Tes ulang</button>
                    <button type="button" disabled={pending} onClick={() => { abort.current?.abort(); send(false); }} className="min-h-12 flex-1 rounded-full text-sm font-semibold text-muted hover:text-ink disabled:opacity-50">Kirim tanpa tes</button>
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="mt-4 space-y-4">
                <p className="text-ink/80">Laporanmu tampil di halaman kafe selama 3 jam supaya pengunjung lain tahu kondisi terbarunya.</p>
                <button type="button" onClick={close} className="btn-primary min-h-12 w-full">Selesai</button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
