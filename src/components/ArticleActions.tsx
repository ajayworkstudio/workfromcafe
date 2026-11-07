"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Icon from "./Icon";
import ShareButton from "./ShareButton";
import { setArticleLike, setArticleSave } from "@/app/artikel/actions";
import { useT } from "@/components/I18nProvider";

/**
 * Baris aksi artikel: suka, simpan, bagikan, dan jumlah dilihat.
 * Suka dan simpan berubah langsung di layar, lalu dikirim ke server; kalau gagal, dikembalikan.
 * Pengunjung yang belum login diarahkan ke halaman Masuk.
 */
export default function ArticleActions({ id, slug, title, url, liked, saved, likes, views, loggedIn, track = false, variant = "bar", hideSave = false }: {
  id: string; slug: string; title: string; url: string;
  liked: boolean; saved: boolean; likes: number; views: number; loggedIn: boolean;
  /** Catat kunjungan (pasang di satu baris aksi saja per halaman) */
  track?: boolean;
  /** "save" = hanya tombol simpan bulat kaca, untuk di atas foto sampul */
  variant?: "bar" | "save";
  /** Sembunyikan tombol simpan di baris aksi (kalau tombol simpan sudah ada di atas foto) */
  hideSave?: boolean;
}) {
  const router = useRouter();
  const { t, locale } = useT();
  const [like, setLike] = useState({ on: liked, n: likes });
  const [save, setSave] = useState(saved);
  const [msg, setMsg] = useState("");
  const [, start] = useTransition();

  useEffect(() => {
    if (!track) return;
    const body = JSON.stringify({ article_id: id });
    try {
      if (!navigator.sendBeacon?.("/api/lihat-artikel", new Blob([body], { type: "application/json" }))) {
        fetch("/api/lihat-artikel", { method: "POST", body, headers: { "content-type": "application/json" }, keepalive: true }).catch(() => {});
      }
    } catch { /* tidak boleh mengganggu pembaca */ }
  }, [id, track]);

  const needLogin = () => router.push(`/masuk?next=${encodeURIComponent(`/artikel/${slug}`)}`);

  function toggleLike() {
    if (!loggedIn) return needLogin();
    const prev = like;
    const next = { on: !like.on, n: Math.max(0, like.n + (like.on ? -1 : 1)) };
    setLike(next);
    start(async () => {
      const r = await setArticleLike(id, next.on, slug);
      if (!r.ok) { setLike(prev); if (r.login) needLogin(); else setMsg(t("Gagal menyimpan. Coba lagi.")); }
    });
  }
  function toggleSave() {
    if (!loggedIn) return needLogin();
    const next = !save;
    setSave(next);
    start(async () => {
      const r = await setArticleSave(id, next, slug);
      if (!r.ok) { setSave(!next); if (r.login) needLogin(); else setMsg(t("Gagal menyimpan. Coba lagi.")); }
      else setMsg(next ? t("Tersimpan. Buka lagi kapan saja dari halaman Akun.") : "");
    });
  }

  const n = (v: number) => v.toLocaleString(locale);
  if (variant === "save") {
    return (
      <>
        <button type="button" onClick={toggleSave} aria-pressed={save} aria-label={save ? t("Tersimpan, ketuk untuk batal") : t("Simpan artikel")}
          className="glass-dark grid h-11 w-11 shrink-0 place-items-center rounded-full text-foam transition active:scale-95">
          <Icon name="bookmark" filled={save} className="h-5 w-5" />
        </button>
        <span role="status" className="sr-only">{msg}</span>
      </>
    );
  }
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={toggleLike} aria-pressed={like.on}
          className={`btn min-h-11 border ${like.on ? "border-[#b4533a] bg-[#b4533a]/10 text-[#8c3b25]" : "border-line bg-surface hover:border-mist"}`}>
          <Icon name="heart" filled={like.on} className="h-4 w-4" />{like.on ? t("Disukai") : t("Suka")}{like.n > 0 && <span className="font-normal">· {n(like.n)}</span>}
        </button>
        {!hideSave && (
          <button type="button" onClick={toggleSave} aria-pressed={save}
            className={`btn min-h-11 border ${save ? "border-ink bg-ink text-white" : "border-line bg-surface hover:border-mist"}`}>
            <Icon name="bookmark" filled={save} className="h-4 w-4" />{save ? t("Tersimpan") : t("Simpan")}
          </button>
        )}
        <ShareButton url={url} title={title} text={title} className="btn min-h-11 border border-line bg-surface hover:border-mist" />
        <span className="ml-auto flex items-center gap-1.5 text-sm text-muted"><Icon name="eye" className="h-4 w-4" />{t("Dilihat {n} kali", { n: n(views) })}</span>
      </div>
      {msg && <p role="status" className="mt-2 text-sm text-muted">{msg}</p>}
    </div>
  );
}
