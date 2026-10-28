import type { Metadata } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import PageHeader from "@/components/admin/PageHeader";
import Flash from "@/components/admin/Flash";
import ConfirmButton from "@/components/admin/ConfirmButton";
import SubmitButton from "@/components/admin/SubmitButton";
import Icon from "@/components/Icon";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { SITE_URL } from "@/lib/utils";
import { cleanText, SOURCE_LABEL, type Supporter } from "@/lib/supporters";

export const metadata: Metadata = { title: "Pendukung" };

const back = (msg: string, err = false) => redirect(`/admin/pendukung?${err ? "err" : "ok"}=${encodeURIComponent(msg)}`);

async function addSupporter(f: FormData) {
  "use server";
  await requireAdmin();
  const name = cleanText(f.get("name"), 60);
  if (!name) back("Isi nama pendukung (boleh \"Seseorang\" kalau ingin anonim).", true);
  const date = String(f.get("date") ?? "");
  const { error } = await (await createClient()).from("supporters").insert({
    source: "manual", name, message: cleanText(f.get("message"), 240),
    amount: Number(String(f.get("amount") ?? "").replace(/\D/g, "")) || null,
    ...(/^\d{4}-\d{2}-\d{2}$/.test(date) ? { created_at: `${date}T12:00:00+07:00` } : {}),
  });
  revalidatePath("/dukung");
  back(error ? `Gagal menyimpan: ${error.message}` : `${name} ditambahkan ke daftar pendukung.`, !!error);
}

async function toggleHidden(f: FormData) {
  "use server";
  await requireAdmin();
  await (await createClient()).from("supporters").update({ is_hidden: f.get("hide") === "1" }).eq("id", String(f.get("id")));
  revalidatePath("/dukung");
  revalidatePath("/admin/pendukung");
}

async function removeSupporter(f: FormData) {
  "use server";
  await requireAdmin();
  await (await createClient()).from("supporters").delete().eq("id", String(f.get("id")));
  revalidatePath("/dukung");
  back("Pendukung dihapus.");
}

const rp = (n: number | null) => (n == null ? "-" : `Rp${n.toLocaleString("id-ID")}`);

export default async function SupportersAdmin({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const { data, error } = await (await createClient()).from("supporters").select("*").order("created_at", { ascending: false }).limit(300);
  const rows = (data as Supporter[] | null) ?? [];
  const total = rows.reduce((a, r) => a + (r.amount ?? 0), 0);
  const hooks = [
    { name: "Saweria", url: `${SITE_URL}/api/dukungan/saweria`, env: "SAWERIA_STREAM_KEY", ready: !!process.env.SAWERIA_STREAM_KEY,
      how: "Saweria → Integrasi → Webhook: tempel URL ini, aktifkan. Salin Stream Key (Saweria → Overlay/Integrasi) ke env SAWERIA_STREAM_KEY di Vercel." },
    { name: "Trakteer", url: `${SITE_URL}/api/dukungan/trakteer`, env: "TRAKTEER_WEBHOOK_TOKEN", ready: !!process.env.TRAKTEER_WEBHOOK_TOKEN,
      how: "Trakteer → Integrations → Webhook: tempel URL ini. Salin Webhook Token yang diberikan ke env TRAKTEER_WEBHOOK_TOKEN di Vercel." },
  ];

  return (
    <>
      <PageHeader title="Pendukung" description="Yang sudah mendukung WFC Hunters. Nama dan pesan tampil di halaman /dukung; nominal dan email hanya terlihat di sini." />
      <Flash ok={sp.ok} err={sp.err} />
      {error && <p className="mb-5 rounded-xl bg-tint px-4 py-3 text-sm">Daftar pendukung belum aktif. Jalankan migrasi <code>0024_pendukung.sql</code> di Supabase.</p>}

      <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 text-sm">
            <span className="font-semibold">{rows.length} pendukung</span>
            {total > 0 && <span className="text-muted">Total tercatat {rp(total)}</span>}
          </div>
          {!rows.length ? (
            <p className="p-6 text-center text-muted">Belum ada. Pendukung dari Saweria/Trakteer masuk otomatis setelah webhook diatur, atau tambahkan manual di samping.</p>
          ) : (
            <ul className="divide-y divide-line">
              {rows.map((r) => (
                <li key={r.id} className={`flex flex-wrap items-start gap-3 p-4 ${r.is_hidden ? "opacity-55" : ""}`}>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{r.name}</span>
                      <span className="chip">{SOURCE_LABEL[r.source]}</span>
                      {r.is_hidden && <span className="chip">Disembunyikan</span>}
                    </p>
                    {r.message && <p className="mt-1 break-words text-sm">{r.message}</p>}
                    <p className="mt-1 text-xs text-muted">
                      {new Date(r.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" })} · {rp(r.amount)}{r.email ? ` · ${r.email}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <form action={toggleHidden}>
                      <input type="hidden" name="id" value={r.id} /><input type="hidden" name="hide" value={r.is_hidden ? "0" : "1"} />
                      <button className="btn-ghost !px-3 !py-2" title={r.is_hidden ? "Tampilkan di /dukung" : "Sembunyikan dari /dukung"}>
                        <Icon name={r.is_hidden ? "eye" : "eyeOff"} className="h-4 w-4" /><span className="sr-only">{r.is_hidden ? "Tampilkan" : "Sembunyikan"}</span>
                      </button>
                    </form>
                    <form action={removeSupporter}>
                      <input type="hidden" name="id" value={r.id} />
                      <ConfirmButton message={`Hapus ${r.name} dari daftar pendukung?`} pendingText="…" className="btn !px-3 !py-2 border border-red-200 bg-surface text-red-700 hover:bg-red-600 hover:text-white">
                        <Icon name="trash" className="h-4 w-4" /><span className="sr-only">Hapus</span>
                      </ConfirmButton>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="space-y-5">
          <form action={addSupporter} className="card space-y-3 p-5">
            <h2 className="text-lg font-bold">Tambah manual</h2>
            <p className="text-sm text-muted">Untuk dukungan lewat transfer, QRIS, atau dari sebelum webhook diatur.</p>
            <div><label htmlFor="s-name" className="label">Nama</label><input id="s-name" name="name" required maxLength={60} placeholder="Nama, atau Seseorang" className="input" /></div>
            <div><label htmlFor="s-msg" className="label">Pesan (opsional)</label><textarea id="s-msg" name="message" maxLength={240} rows={2} className="input" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label htmlFor="s-amt" className="label">Nominal</label><input id="s-amt" name="amount" inputMode="numeric" placeholder="25000" className="input" /></div>
              <div><label htmlFor="s-date" className="label">Tanggal</label><input id="s-date" name="date" type="date" className="input" /></div>
            </div>
            <SubmitButton>Tambah</SubmitButton>
          </form>

          <section className="card space-y-4 p-5">
            <h2 className="text-lg font-bold">Otomatis dari Saweria / Trakteer</h2>
            {hooks.map((h) => (
              <div key={h.name} className="space-y-1.5 text-sm">
                <p className="flex items-center gap-2 font-semibold">{h.name}
                  <span className={`chip ${h.ready ? "!bg-ok/10 !text-ok" : ""}`}>{h.ready ? "Siap" : `Isi ${h.env}`}</span>
                </p>
                <code className="block break-all rounded-lg bg-tint px-3 py-2 text-xs">{h.url}</code>
                <p className="text-muted">{h.how}</p>
              </div>
            ))}
          </section>
        </div>
      </div>
    </>
  );
}
