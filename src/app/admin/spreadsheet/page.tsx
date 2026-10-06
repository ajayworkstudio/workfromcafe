import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { sheetExportUrl, summarize, syncFromUrlAndRecord, type SyncReport } from "@/lib/sheetSync";
import PageHeader from "@/components/admin/PageHeader";
import Flash from "@/components/admin/Flash";
import SubmitButton from "@/components/admin/SubmitButton";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function saveUrl(formData: FormData) {
  "use server";
  await requireAdmin();
  const url = String(formData.get("sheet_url") || "").trim();
  if (url && !sheetExportUrl(url)) redirect(`/admin/spreadsheet?err=${encodeURIComponent("Itu bukan link Google Sheets.")}`);
  await createAdminClient().from("app_settings").upsert({ key: "sheet_url", value: url });
  revalidateTag("settings");
  revalidatePath("/admin/spreadsheet");
  redirect(`/admin/spreadsheet?ok=${encodeURIComponent(url ? "Link spreadsheet disimpan." : "Link spreadsheet dihapus.")}`);
}

async function syncNow() {
  "use server";
  await requireAdmin();
  const s = await getSettings();
  if (!s.sheet_url) redirect(`/admin/spreadsheet?err=${encodeURIComponent("Simpan link Google Sheets dulu.")}`);
  const res = await syncFromUrlAndRecord(createAdminClient(), s.sheet_url, "manual");
  revalidatePath("/", "layout");
  redirect(res.ok ? `/admin/spreadsheet?ok=${encodeURIComponent("Sinkron selesai: " + summarize(res.report))}` : `/admin/spreadsheet?err=${encodeURIComponent(res.error)}`);
}

async function uploadFile(formData: FormData) {
  "use server";
  await requireAdmin();
  const file = formData.get("file") as File | null;
  if (!file || !file.size) redirect(`/admin/spreadsheet?err=${encodeURIComponent("Pilih file .xlsx dulu.")}`);
  if (!file!.name.toLowerCase().endsWith(".xlsx")) redirect(`/admin/spreadsheet?err=${encodeURIComponent("File harus berformat .xlsx.")}`);
  const res = await syncFromUrlAndRecord(createAdminClient(), "", "upload", Buffer.from(await file!.arrayBuffer()));
  revalidatePath("/", "layout");
  redirect(res.ok ? `/admin/spreadsheet?ok=${encodeURIComponent("Import selesai: " + summarize(res.report))}` : `/admin/spreadsheet?err=${encodeURIComponent(res.error)}`);
}

type Last = { at: string; source: string; ok: boolean; report?: SyncReport; error?: string };

export default async function SpreadsheetPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const [sp, s] = await Promise.all([searchParams, getSettings()]);
  let last: Last | null = null;
  try { last = s.sheet_last_sync ? JSON.parse(s.sheet_last_sync) : null; } catch {}

  return (
    <>
      <PageHeader title="Spreadsheet" description="Kelola banyak kafe sekaligus dari Google Sheets atau file Excel." />
      <Flash ok={sp.ok} err={sp.err} />

      <div className="grid max-w-3xl gap-5">
        <section className="card space-y-4 p-5 md:p-6">
          <h2 className="text-lg font-bold">1. Siapkan spreadsheet</h2>
          <p className="text-sm text-muted">
            Pakai template supaya nama kolomnya cocok. Di Google Sheets: File → Impor → Upload template, lalu klik Bagikan → Akses umum →
            &quot;Siapa saja yang memiliki link&quot; (Pelihat).
          </p>
          <a href="/template-workfromcafe.xlsx" download className="btn-ghost">Download template Excel</a>
        </section>

        <section className="card space-y-4 p-5 md:p-6">
          <h2 className="text-lg font-bold">2. Sambungkan Google Sheets</h2>
          <form action={saveUrl} className="flex flex-wrap gap-2">
            <label htmlFor="sheet_url" className="sr-only">Link Google Sheets</label>
            <input id="sheet_url" name="sheet_url" type="url" defaultValue={s.sheet_url} placeholder="https://docs.google.com/spreadsheets/d/…/edit" className="input min-w-[240px] flex-1" />
            <SubmitButton className="btn-dark">Simpan link</SubmitButton>
          </form>
          {s.sheet_url && (
            <form action={syncNow} className="flex flex-wrap items-center gap-3">
              <SubmitButton className="btn-primary">Sinkronkan sekarang</SubmitButton>
              <span className="text-sm text-muted">Sinkron juga berjalan otomatis setiap hari sekitar jam 08.00 WIB.</span>
            </form>
          )}
        </section>

        <section className="card space-y-4 p-5 md:p-6">
          <h2 className="text-lg font-bold">Atau upload file Excel</h2>
          <form action={uploadFile} className="flex flex-wrap items-center gap-3">
            <input type="file" name="file" accept=".xlsx" required aria-label="File Excel"
              className="text-sm file:mr-3 file:cursor-pointer file:rounded-full file:border file:border-line file:bg-surface file:px-4 file:py-2 file:text-sm file:font-semibold" />
            <SubmitButton className="btn-dark">Import</SubmitButton>
          </form>
        </section>

        <section className="card space-y-2 p-5 text-sm md:p-6">
          <h2 className="text-lg font-bold">Cara kerja sinkron</h2>
          <ul className="list-disc space-y-1 pl-5 text-muted">
            <li>Kafe dicocokkan lewat kolom <b>slug</b>. Kalau kosong, slug dibuat dari nama kafe.</li>
            <li>Sel yang kosong tidak mengubah data yang sudah ada, jadi editan dari panel admin tetap aman.</li>
            <li>Kafe yang tidak ada di spreadsheet tidak dihapus.</li>
            <li>Untuk kafe yang ada di tab Menu, daftar menunya diganti sesuai spreadsheet.</li>
            <li>Kafe baru masuk sebagai draf, kecuali kolom <b>tayang</b> diisi YA.</li>
          </ul>
        </section>

        {last && (
          <section className={`rounded-2xl border p-5 text-sm md:p-6 ${last.ok ? "border-line bg-surface" : "border-red-200 bg-red-50"}`}>
            <h2 className="text-lg font-bold">Sinkron terakhir</h2>
            <p className="mt-1 text-muted">
              {new Date(last.at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" })} WIB ·{" "}
              {last.source === "cron" ? "otomatis" : last.source === "upload" ? "upload file" : "manual"}
            </p>
            {last.ok && last.report ? (
              <>
                <p className="mt-2 font-medium">{summarize(last.report)}</p>
                {!!last.report.warnings.length && (
                  <details className="mt-3">
                    <summary className="cursor-pointer font-medium text-[#8a5a00]">{last.report.warnings.length} peringatan</summary>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">{last.report.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
                  </details>
                )}
              </>
            ) : (
              <p className="mt-2 text-red-800">{last.error}</p>
            )}
          </section>
        )}
      </div>
    </>
  );
}
