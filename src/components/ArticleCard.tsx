import Link from "next/link";
import FadeImage from "./FadeImage";
import ArticleByline from "./ArticleByline";
import type { ManualArticle } from "@/lib/articles";
import { getT } from "@/lib/i18n/server";

/** Kartu foto artikel: judul dan penulis di atas gradasi espresso. Dipakai di /artikel dan beranda. */
export default async function ArticleCard({ a, cover, label, excerpt = false, priority = false }: {
  a: ManualArticle; cover?: string | null; label: string;
  /** Tampilkan cuplikan isi + ajakan baca selengkapnya (beranda) */
  excerpt?: boolean;
  priority?: boolean;
}) {
  const { t } = await getT();
  return (
    <Link href={`/artikel/${a.slug}`} className="group relative isolate flex aspect-[4/5] flex-col justify-end overflow-hidden rounded-[1.75rem] bg-espresso p-5 text-foam">
      {cover && <FadeImage src={cover} alt="" fill priority={priority} sizes="(max-width:768px) 78vw, 352px" className="-z-10 object-cover transition duration-500 group-hover:scale-[1.04]" />}
      <span className="absolute inset-0 -z-10 bg-gradient-to-t from-espresso via-espresso/60 to-espresso/0" aria-hidden />
      <span className="glass-dark absolute left-4 top-4 rounded-full px-3 py-1 text-xs font-semibold">{t(label)}</span>
      <h3 className="line-clamp-3 text-[1.6rem] font-extrabold leading-[1.12] [text-shadow:0_2px_14px_rgb(0_0_0/0.35)]">{a.title}</h3>
      {excerpt && a.excerpt && <p className="mt-2 line-clamp-2 text-sm text-foam/80">{a.excerpt}</p>}
      <ArticleByline a={a} light />
      {excerpt && <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-gold">{t("Baca selengkapnya")}<span aria-hidden className="transition group-hover:translate-x-0.5">→</span></span>}
    </Link>
  );
}
