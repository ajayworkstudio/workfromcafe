"use client";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { usePathname } from "next/navigation";
import { sendContact } from "@/app/kontak/actions";
import { CONTACT_TOPICS, type ContactState } from "@/lib/contact";
import { INSTAGRAM_URL } from "@/lib/utils";
import Icon from "./Icon";

type Props = {
  defaultName?: string | null;
  defaultEmail?: string | null;
  communityUrl?: string;
  /** Topik yang langsung terpilih, mis. "koreksi" dari halaman kafe. */
  defaultTopic?: string;
  headingLevel?: "h1" | "h2";
};

export default function ContactBox({ defaultName, defaultEmail, communityUrl, defaultTopic, headingLevel = "h2" }: Props) {
  const [state, action] = useActionState<ContactState, FormData>(sendContact, null);
  const [round, setRound] = useState(0); // kunci untuk mengosongkan form setelah "kirim pesan lain"
  // Isian dikendalikan state supaya tidak hilang saat server mengembalikan pesan error
  // (React mengosongkan form setiap kali action selesai).
  const [body, setBody] = useState("");
  const [name, setName] = useState(defaultName ?? "");
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [topic, setTopic] = useState(defaultTopic ?? "saran");
  const page = usePathname();
  const id = useId();
  const H = headingLevel;
  const successRef = useRef<HTMLDivElement>(null);
  const [sentRound, setSentRound] = useState(-1);
  const sent = state?.ok === true && sentRound === round;

  useEffect(() => {
    if (state?.ok) { setSentRound(round); setBody(""); }
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (sent) successRef.current?.focus(); }, [sent]);

  const err = state && !state.ok ? state : null;
  const invalid = (f: "name" | "email" | "body" | "topic") => err?.field === f || undefined;

  return (
    <div className="grid gap-8 md:grid-cols-[0.9fr_1.1fr] md:gap-12">
      <div>
        <H className="text-3xl font-extrabold leading-tight md:text-4xl">Ada kafe yang harus aku datangi?</H>
        <p className="mt-3 max-w-md text-ink/75">
          Tulis saja di sini: saran kafe, koreksi jam buka atau harga, tawaran kerja sama, atau kamu pemilik kafe yang mau kafenya dicoba.
          Pesannya masuk langsung ke aku dan dibalas lewat email.
        </p>
        <div className="mt-6 space-y-2 text-sm">
          <p className="font-semibold">Lebih suka ngobrol langsung?</p>
          <a href={INSTAGRAM_URL} target="_blank" rel="noopener" className="flex min-h-11 items-center gap-2 text-ink/80 hover:text-brand">
            <Icon name="instagram" className="h-5 w-5" />DM Instagram @wfchunters
          </a>
          {communityUrl && (
            <a href={communityUrl} target="_blank" rel="noopener" className="flex min-h-11 items-center gap-2 text-ink/80 hover:text-brand">
              <Icon name="whatsapp" className="h-5 w-5" />Grup komunitas WhatsApp
            </a>
          )}
        </div>
      </div>

      {sent ? (
        <div ref={successRef} tabIndex={-1} role="status" className="flex flex-col items-start justify-center rounded-2xl bg-brand-soft p-6 outline-none md:p-8">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-ok text-white"><Icon name="check" className="h-6 w-6" /></span>
          <p className="mt-4 text-xl font-bold">Terima kasih{state?.ok && state.name ? `, ${state.name}` : ""}. Pesanmu sudah masuk.</p>
          <p className="mt-1 text-ink/75">Balasannya akan dikirim ke email yang kamu tulis tadi.</p>
          <button type="button" onClick={() => setRound((r) => r + 1)} className="btn-ghost mt-5">Kirim pesan lain</button>
        </div>
      ) : (
        <form key={round} action={action} noValidate className="space-y-4">
          <input type="hidden" name="page" value={page} />
          {/* Kolom jebakan bot, tersembunyi dari pengguna dan pembaca layar */}
          <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
            <label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
          </div>

          <fieldset>
            <legend className="label">Soal apa?</legend>
            <div className="flex flex-wrap gap-2" aria-invalid={invalid("topic")}>
              {CONTACT_TOPICS.map((t) => (
                <label key={t.value} className="cursor-pointer">
                  <input type="radio" name="topic" value={t.value} checked={topic === t.value} onChange={() => setTopic(t.value)} className="peer sr-only" />
                  <span className="flex min-h-11 items-center rounded-xl border border-line bg-surface px-3.5 text-sm font-medium transition-colors hover:border-mist peer-checked:border-brand peer-checked:bg-brand peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-brand peer-focus-visible:ring-offset-2">
                    {t.label}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor={`${id}-name`} className="label">Nama</label>
              <input id={`${id}-name`} name="name" required minLength={2} maxLength={80} autoComplete="name"
                value={name} onChange={(e) => setName(e.target.value)} aria-invalid={invalid("name")} className="input min-h-11 aria-[invalid=true]:border-[#b4533a]" />
            </div>
            <div>
              <label htmlFor={`${id}-email`} className="label">Email untuk balasan</label>
              <input id={`${id}-email`} name="email" type="email" required maxLength={160} autoComplete="email" inputMode="email"
                value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={invalid("email")} className="input min-h-11 aria-[invalid=true]:border-[#b4533a]" />
            </div>
          </div>

          <div>
            <label htmlFor={`${id}-body`} className="label">Pesan</label>
            <textarea id={`${id}-body`} name="body" required minLength={10} maxLength={2000} rows={5}
              value={body} onChange={(e) => setBody(e.target.value)} aria-invalid={invalid("body")}
              placeholder="Untuk saran kafe: tulis nama kafe, kotanya, dan kenapa enak buat kerja (colokan, wifi, jam buka)."
              className="input resize-y aria-[invalid=true]:border-[#b4533a]" />
            <p className={`mt-1 text-right text-xs tabular-nums ${body.length > 1800 ? "text-[#b4533a]" : "text-muted"}`}>{body.length}/2000</p>
          </div>

          {err && <p role="alert" className="rounded-xl bg-[#b4533a]/10 px-3.5 py-2.5 text-sm text-[#8c3b25]">{err.error}</p>}
          <Submit />
        </form>
      )}
    </div>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className="btn-primary min-h-11 w-full sm:w-auto">
      <Icon name="send" className="h-4 w-4" />{pending ? "Mengirim…" : "Kirim pesan"}
    </button>
  );
}
