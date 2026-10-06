import Icon from "./Icon";
import CommunityCard from "./CommunityCard";

const IDEAS = [
  { icon: "users", title: "Kerja bareng", text: "Sesi kerja fokus bareng di kafe pilihan, kenalan sesama remote worker dan mahasiswa." },
  { icon: "pin", title: "Cafe hopping", text: "Jelajah beberapa kafe dalam satu hari dan nilai bareng-bareng." },
  { icon: "edit", title: "Workshop singkat", text: "Belajar hal praktis di kafe: produktivitas, desain, sampai bikin konten." },
  { icon: "star", title: "Meetup author", text: "Kopdar para author dan WFC Hunters di kotamu." },
];

/** Halaman "Segera" untuk pengunjung umum selama menu Event belum dibuka. */
export default function EventTeaser({ communityUrl }: { communityUrl: string }) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <section className="relative overflow-hidden rounded-3xl bg-brand p-7 text-white md:p-12">
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-tan/25 blur-3xl" aria-hidden />
        <span className="relative inline-flex items-center gap-1.5 rounded-full bg-gold px-3 py-1 text-sm font-bold text-ink">
          <Icon name="lock" className="h-3.5 w-3.5" />Segera
        </span>
        <h1 className="relative mt-4 max-w-2xl text-4xl font-extrabold leading-[1.05] md:text-5xl">Event WorkFromCafe sedang disiapkan.</h1>
        <p className="relative mt-4 max-w-xl text-lg text-white/75">
          Sebentar lagi kamu bisa ikut acara seru bareng WFC Hunters dan para author di kafe-kafe pilihan.
        </p>
      </section>

      <h2 className="mt-12 text-2xl font-bold">Yang sedang kami siapkan</h2>
      <ul className="mt-5 grid gap-3 sm:grid-cols-2">
        {IDEAS.map((i) => (
          <li key={i.title} className="card flex gap-4 p-5">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand"><Icon name={i.icon} className="h-5 w-5" /></span>
            <span>
              <span className="block font-bold">{i.title}</span>
              <span className="mt-0.5 block text-sm text-muted">{i.text}</span>
            </span>
          </li>
        ))}
      </ul>

      {communityUrl && (
        <div className="mt-10">
          <p className="mb-3 text-sm font-semibold text-muted">Mau jadi yang pertama tahu jadwalnya?</p>
          <CommunityCard url={communityUrl} variant="compact" />
        </div>
      )}
    </div>
  );
}
