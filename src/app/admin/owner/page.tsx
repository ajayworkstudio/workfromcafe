import type { Metadata } from "next";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import PageHeader from "@/components/admin/PageHeader";
import Flash from "@/components/admin/Flash";
import SubmitButton from "@/components/admin/SubmitButton";
import ConfirmButton from "@/components/admin/ConfirmButton";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Owner kafe" };

const back = (msg: string, err = false, q = ""): never =>
  redirect(`/admin/owner?${err ? "err" : "ok"}=${encodeURIComponent(msg)}${q ? `&q=${encodeURIComponent(q)}` : ""}`);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const cleanEmail = (v: FormDataEntryValue | null) => String(v ?? "").trim().toLowerCase();

/** Cari akun WFC Hunters dari email (dipakai untuk menambah atau memindahkan owner). */
async function userByEmail(email: string) {
  const { data } = await createAdminClient().from("profiles").select("id,name,email").ilike("email", email).limit(1).maybeSingle();
  return data as { id: string; name: string | null; email: string } | null;
}

// Ganti email login akun owner. Langsung berlaku tanpa email konfirmasi; login Google tetap tersambung ke akun yang sama.
async function changeEmail(f: FormData) {
  "use server";
  await requireAdmin();
  const userId = String(f.get("user_id") ?? "");
  const email = cleanEmail(f.get("email"));
  if (!EMAIL.test(email)) back("Format email tidak valid.", true);
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) back("SUPABASE_SERVICE_ROLE_KEY belum diisi di Vercel.", true);
  const other = await userByEmail(email);
  if (other && other.id !== userId) back(`Email ${email} sudah dipakai akun lain (${other.name ?? "tanpa nama"}). Pakai "Pindahkan ke akun lain" kalau owner sudah punya akun dengan email itu.`, true);
  const db = createAdminClient();
  const { error } = await db.auth.admin.updateUserById(userId, { email, email_confirm: true });
  if (error) back(`Gagal mengganti email: ${error.message}`, true);
  await db.from("profiles").update({ email }).eq("id", userId);
  revalidatePath("/admin/owner");
  back(`Email login diganti ke ${email}. Owner sekarang masuk dengan email itu (kata sandi tidak berubah).`);
}

// Pindahkan kepemilikan kafe ke akun lain yang sudah terdaftar (misalnya owner ganti orang atau pakai akun baru).
async function transfer(f: FormData) {
  "use server";
  await requireAdmin();
  const id = String(f.get("id") ?? "");
  const email = cleanEmail(f.get("email"));
  if (!EMAIL.test(email)) back("Format email tidak valid.", true);
  const target = await userByEmail(email);
  if (!target) back(`Belum ada akun dengan email ${email}. Minta owner daftar dulu di wfchunters.com/masuk.`, true);
  const supabase = await createClient();
  const { error } = await supabase.from("cafe_owners").update({ user_id: target!.id }).eq("id", id);
  if (error) back(/duplicate/.test(error.message) ? "Akun itu sudah terdaftar sebagai owner kafe ini." : `Gagal memindahkan: ${error.message}`, true);
  revalidatePath("/admin/owner");
  back(`Kepemilikan dipindahkan ke ${target!.name ?? email}.`);
}

async function addOwner(f: FormData) {
  "use server";
  await requireAdmin();
  const cafeId = String(f.get("cafe_id") ?? "");
  const email = cleanEmail(f.get("email"));
  if (!cafeId) back("Pilih kafenya.", true);
  if (!EMAIL.test(email)) back("Format email tidak valid.", true);
  const target = await userByEmail(email);
  if (!target) back(`Belum ada akun dengan email ${email}. Minta owner daftar dulu di wfchunters.com/masuk.`, true);
  const { error } = await (await createClient()).from("cafe_owners").insert({ cafe_id: cafeId, user_id: target!.id, verified_at: new Date().toISOString() });
  if (error) back(/duplicate/.test(error.message) ? "Akun itu sudah terdaftar sebagai owner kafe ini." : `Gagal menambah: ${error.message}`, true);
  revalidatePath("/admin/owner");
  back(`${target!.name ?? email} ditambahkan sebagai owner terverifikasi.`);
}

async function setVerified(f: FormData) {
  "use server";
  await requireAdmin();
  const on = f.get("on") === "1";
  const { error } = await (await createClient()).from("cafe_owners").update({ verified_at: on ? new Date().toISOString() : null }).eq("id", String(f.get("id")));
  revalidatePath("/admin/owner");
  back(error ? `Gagal: ${error.message}` : on ? "Owner diverifikasi." : "Verifikasi dicabut. Owner tidak bisa melihat statistik dan iklan sampai diverifikasi lagi.", !!error);
}

async function removeOwner(f: FormData) {
  "use server";
  await requireAdmin();
  const { error } = await (await createClient()).from("cafe_owners").delete().eq("id", String(f.get("id")));
  revalidatePath("/admin/owner");
  back(error ? `Gagal: ${error.message}` : "Owner dihapus dari kafe ini. Paket, saldo, dan kampanye kafe tetap tersimpan.", !!error);
}

type Row = { id: string; cafe_id: string; user_id: string; role: string; verified_at: string | null; created_at: string; cafe: { name: string; slug: string } | null };

export default async function OwnersAdmin({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string; q?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data, error }, { data: cafes }] = await Promise.all([
    supabase.from("cafe_owners").select("id,cafe_id,user_id,role,verified_at,created_at,cafe:cafes(name,slug)").order("created_at", { ascending: false }),
    supabase.from("cafes").select("id,name").eq("is_published", true).order("name"),
  ]);
  if (error) return <><PageHeader title="Owner kafe" /><p className="rounded-xl bg-tint px-4 py-3 text-sm">Tabel owner belum ada. Jalankan migrasi 0025.</p></>;

  const rows = (data ?? []) as unknown as Row[];
  const ids = [...new Set(rows.map((r) => r.user_id))];
  const { data: people } = ids.length ? await supabase.from("profiles").select("id,name,email").in("id", ids) : { data: [] };
  const who = new Map((people ?? []).map((p) => [p.id as string, p as { id: string; name: string | null; email: string | null }]));
  const q = sp.q?.trim().toLowerCase();
  const shown = q ? rows.filter((r) => `${r.cafe?.name} ${who.get(r.user_id)?.name ?? ""} ${who.get(r.user_id)?.email ?? ""}`.toLowerCase().includes(q)) : rows;

  return (
    <>
      <PageHeader title="Owner kafe" description="Semua akun yang mengelola kafe. Ganti email login, pindahkan ke akun lain, atau tambah owner." />
      <Flash ok={sp.ok} err={sp.err} />

      <form className="mb-4">
        <label className="block max-w-sm">
          <span className="sr-only">Cari owner</span>
          <input name="q" type="search" defaultValue={sp.q} placeholder="Cari nama kafe, nama, atau email" className="input" />
        </label>
      </form>

      {shown.length ? (
        <ul className="space-y-3">
          {shown.map((r) => {
            const p = who.get(r.user_id);
            return (
              <li key={r.id} className="card p-4 md:p-5">
                <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{r.cafe?.name ?? "Kafe"}</p>
                    <p className="break-words text-sm text-muted">{p?.name ?? "Tanpa nama"} · {p?.email ?? "email tidak diketahui"}</p>
                  </div>
                  <span className={`chip ${r.verified_at ? "!bg-ok/10 !text-ok" : ""}`}>{r.verified_at ? "Terverifikasi" : "Menunggu verifikasi"}</span>
                </div>

                <details className="mt-3 rounded-xl bg-tint/60 p-3">
                  <summary className="cursor-pointer text-sm font-semibold">Kelola</summary>
                  <div className="mt-3 grid gap-4 md:grid-cols-2">
                    <form action={changeEmail} className="space-y-2">
                      <input type="hidden" name="user_id" value={r.user_id} />
                      <label htmlFor={`e-${r.id}`} className="label">Ganti email login akun ini</label>
                      <input id={`e-${r.id}`} name="email" type="email" required defaultValue={p?.email ?? ""} className="input" />
                      <SubmitButton className="btn-primary min-h-11 text-sm">Simpan email</SubmitButton>
                    </form>
                    <form action={transfer} className="space-y-2">
                      <input type="hidden" name="id" value={r.id} />
                      <label htmlFor={`t-${r.id}`} className="label">Pindahkan ke akun lain (email terdaftar)</label>
                      <input id={`t-${r.id}`} name="email" type="email" required placeholder="email@kafe.com" className="input" />
                      <ConfirmButton message={`Pindahkan ${r.cafe?.name} ke akun lain? Akun ${p?.email ?? "ini"} tidak bisa mengelolanya lagi.`} className="btn-ghost min-h-11 text-sm">Pindahkan</ConfirmButton>
                    </form>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-3">
                    <form action={setVerified}>
                      <input type="hidden" name="id" value={r.id} /><input type="hidden" name="on" value={r.verified_at ? "0" : "1"} />
                      <SubmitButton className="btn-ghost min-h-11 text-sm">{r.verified_at ? "Cabut verifikasi" : "Verifikasi"}</SubmitButton>
                    </form>
                    <Link href={`/admin/owner-chat/${r.cafe_id}`} className="btn-ghost min-h-11 text-sm">Chat</Link>
                    <Link href={`/admin/statistik/${r.cafe_id}`} className="btn-ghost min-h-11 text-sm">Statistik</Link>
                    <form action={removeOwner}>
                      <input type="hidden" name="id" value={r.id} />
                      <ConfirmButton message={`Hapus ${p?.name ?? "owner ini"} dari ${r.cafe?.name}?`} className="btn-ghost min-h-11 text-sm text-[#b4533a]">Hapus owner</ConfirmButton>
                    </form>
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      ) : <p className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">{q ? "Tidak ada yang cocok." : "Belum ada owner."}</p>}

      <section className="card mt-8 p-5">
        <h2 className="text-lg font-bold">Tambah owner</h2>
        <p className="mt-0.5 text-sm text-muted">Untuk owner yang sudah kamu kenal. Akunnya harus sudah terdaftar; langsung terverifikasi.</p>
        <form action={addOwner} className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
          <div><label htmlFor="add-c" className="label">Kafe</label>
            <select id="add-c" name="cafe_id" required defaultValue="" className="input"><option value="" disabled>Pilih kafe</option>{(cafes ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div><label htmlFor="add-e" className="label">Email akun owner</label><input id="add-e" name="email" type="email" required placeholder="owner@kafe.com" className="input" /></div>
          <SubmitButton className="btn-primary min-h-11">Tambah</SubmitButton>
        </form>
      </section>
    </>
  );
}
