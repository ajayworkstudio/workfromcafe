import Link from "next/link";
import Icon from "./Icon";
import { SUGGESTION_TOPICS } from "@/lib/contact";

const ICONS: Record<string, string> = { bug: "bug", koreksi: "edit", platform: "sparkle", kritik: "chat" };

/** Kotak saran: empat pilihan yang langsung membuka halaman kontak dengan topik terpilih. */
export default function SuggestionBox() {
  return (
    <section aria-labelledby="saran-judul" className="reveal rounded-[1.75rem] border border-line bg-surface p-6 md:p-9">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="saran-judul" className="text-2xl font-bold md:text-3xl">Kotak saran</h2>
          <p className="mt-1 max-w-xl text-muted">Bantu WFC Hunters jadi lebih baik. Pilih topiknya, lalu kirim lewat form, email, atau DM Instagram.</p>
        </div>
        <Link href="/dukung" className="btn-ghost min-h-11 shrink-0"><Icon name="heart" className="h-4 w-4 text-[#b4533a]" />Dukung pengembangan</Link>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {SUGGESTION_TOPICS.map((t) => (
          <Link key={t.value} href={`/kontak?topik=${t.value}#pesan`}
            className="group flex min-h-24 gap-3 rounded-2xl border border-line p-4 transition-colors hover:border-brand hover:bg-brand-soft/40">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand"><Icon name={ICONS[t.value]} className="h-5 w-5" /></span>
            <span className="min-w-0">
              <span className="flex items-center gap-1 font-semibold">{t.label}<Icon name="chevron" className="h-4 w-4 text-muted transition-transform group-hover:translate-x-0.5" /></span>
              <span className="mt-0.5 block text-sm text-muted">{t.hint}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
