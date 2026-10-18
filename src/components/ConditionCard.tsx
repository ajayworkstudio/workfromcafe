import Avatar from "./Avatar";
import Icon from "./Icon";
import ReportSheet from "./ReportSheet";
import { deleteReport } from "@/app/kafe/[slug]/reports";
import { CROWD, PLUGS, isFresh, reportAgo, summarize, type CafeReport } from "@/lib/reports";

type Props = {
  cafe: { id: string; slug: string; name: string; lat: number | null; lng: number | null };
  reports: CafeReport[];
  viewer: { id: string | null; isAdmin: boolean };
};

// Warna per tingkat keramaian. Hijau & merah bata dibedakan juga oleh terang-gelapnya, bukan warna saja.
const TONE = {
  1: { box: "bg-[#eef6f1]", text: "text-[#2f7049]", dot: "bg-ok" },
  2: { box: "bg-gold/15", text: "text-[#8a5a00]", dot: "bg-gold" },
  3: { box: "bg-[#b4533a]/10", text: "text-[#8c3b25]", dot: "bg-[#b4533a]" },
} as const;

/** Kartu "Kondisi hari ini" di halaman kafe: ringkasan laporan 3 jam terakhir + tombol lapor. */
export default function ConditionCard({ cafe, reports, viewer }: Props) {
  const sum = summarize(reports);
  const fresh = reports.filter((r) => isFresh(r.created_at)).slice(0, 3);
  const last = reports[0];
  const sheet = {
    cafeId: cafe.id, slug: cafe.slug, cafeName: cafe.name, loggedIn: !!viewer.id,
    lat: cafe.lat != null ? Number(cafe.lat) : null, lng: cafe.lng != null ? Number(cafe.lng) : null,
    className: "btn-primary min-h-12 w-full",
  };

  if (!sum) {
    return (
      <section aria-labelledby="kondisi-judul" className="mt-6 space-y-3 rounded-3xl border border-dashed border-mist bg-surface p-4 md:max-w-xl">
        <h2 id="kondisi-judul" className="flex items-center gap-2 font-sans text-base font-extrabold tracking-normal">
          <span className="h-2 w-2 rounded-full bg-mist" />Belum ada laporan hari ini
        </h2>
        <p className="text-sm leading-relaxed text-muted">
          {last
            ? <>Terakhir dilaporkan {reportAgo(last.created_at)}: <b className="text-ink">{CROWD[last.crowd].label}</b>
                {last.download_mbps != null && <>, wifi <b className="text-ink">{Math.round(Number(last.download_mbps))} Mbps</b></>}
                {last.plugs && <>, colokan {PLUGS[last.plugs].toLowerCase()}</>}.</>
            : "Lagi kerja di sini? Kabari pengunjung lain seramai apa kafenya dan seberapa kencang wifinya."}
        </p>
        <ReportSheet {...sheet} label={last ? "Jadi yang pertama lapor" : "Lapor kondisi"} />
        <p className="text-center text-xs text-muted">Laporan hanya bisa dikirim dari dekat kafe.</p>
      </section>
    );
  }

  const tone = TONE[sum.crowd];
  return (
    <section aria-labelledby="kondisi-judul" className="mt-6 space-y-3.5 rounded-3xl border border-line bg-surface p-4 md:max-w-xl">
      <div className="flex items-center justify-between gap-3">
        <h2 id="kondisi-judul" className="flex items-center gap-2 font-sans text-base font-extrabold tracking-normal">
          <span className={`h-2 w-2 rounded-full ${tone.dot}`} />Kondisi hari ini
        </h2>
        <span className="text-xs text-muted">{sum.count} laporan · {reportAgo(sum.lastAt)}</span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className={`flex flex-col gap-1.5 rounded-2xl p-2.5 ${tone.box}`}>
          <Icon name="users" className={`h-5 w-5 ${tone.text}`} />
          <span className="text-[11px] text-muted">Keramaian</span>
          <span className={`font-extrabold ${tone.text}`}>{CROWD[sum.crowd].label}</span>
        </div>
        <div className="flex flex-col gap-1.5 rounded-2xl bg-brand-soft p-2.5">
          <Icon name="wifi" className="h-5 w-5 text-brand" />
          <span className="text-[11px] text-muted">Wifi</span>
          <span className="font-extrabold text-brand">{sum.download != null ? `${sum.download} Mbps` : "Belum dites"}</span>
        </div>
        <div className="flex flex-col gap-1.5 rounded-2xl bg-brand-soft p-2.5">
          <Icon name="plug" className="h-5 w-5 text-brand" />
          <span className="text-[11px] text-muted">Colokan</span>
          <span className="font-extrabold leading-tight text-brand">{sum.plugs ? PLUGS[sum.plugs] : "-"}</span>
        </div>
      </div>

      <ul className="space-y-2 border-t border-tint pt-3">
        {fresh.map((r) => (
          <li key={r.id} className="flex items-start gap-2.5 text-sm">
            <Avatar url={r.author_avatar} name={r.author_name} className="mt-0.5 h-7 w-7 shrink-0 text-xs" />
            <div className="min-w-0 flex-1">
              <p className="break-words">
                <b>{r.author_name.split(" ")[0]}</b> · {CROWD[r.crowd].label}
                {r.download_mbps != null && <> · {Math.round(Number(r.download_mbps))} Mbps</>}
              </p>
              {r.note && <p className="break-words text-muted">{r.note}</p>}
            </div>
            <span className="shrink-0 text-xs text-muted">{reportAgo(r.created_at)}</span>
            {(viewer.isAdmin || viewer.id === r.user_id) && (
              <form action={deleteReport}>
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="slug" value={cafe.slug} />
                <button aria-label="Hapus laporan" title="Hapus laporan" className="-my-2.5 -mr-2 grid h-11 w-11 place-items-center rounded-full text-muted hover:bg-tint hover:text-[#8c3b25]">
                  <Icon name="trash" className="h-4 w-4" />
                </button>
              </form>
            )}
          </li>
        ))}
      </ul>

      <ReportSheet {...sheet} label="Lagi di sini? Lapor kondisi" />
    </section>
  );
}
