import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { BACKUP_TABLES } from "@/lib/backup";

/*
  Bahan backup untuk tombol di Admin → Backup. Hanya admin. Data dikirim per halaman kecil
  (supaya tidak kena batas ukuran respons), lalu dirangkai jadi satu zip di browser admin.
  ?t=<tabel>&from=N  → baris tabel (1000 per halaman)
  ?t=_auth&page=N    → akun pengguna (email, tanggal daftar, cara masuk; tanpa password)
  ?t=_files          → daftar semua file di bucket cafe-photos
*/

export const maxDuration = 60;


const PAGE = 1000;

async function listAll(db: ReturnType<typeof createAdminClient>, prefix = ""): Promise<{ path: string; size: number }[]> {
  const out: { path: string; size: number }[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.storage.from("cafe-photos").list(prefix, { limit: 1000, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw error;
    for (const f of data ?? []) {
      const path = prefix ? `${prefix}/${f.name}` : f.name;
      if (f.id) out.push({ path, size: Number((f.metadata as { size?: number } | null)?.size ?? 0) });
      else out.push(...(await listAll(db, path))); // folder
    }
    if ((data?.length ?? 0) < 1000) break;
  }
  return out;
}

export async function GET(req: Request) {
  try { await requireAdmin(); } catch { return NextResponse.json({ error: "Hanya admin." }, { status: 403 }); }
  const url = new URL(req.url);
  const t = url.searchParams.get("t") ?? "";
  const db = createAdminClient();
  const headers = { "Cache-Control": "no-store" };

  if (t === "_files") {
    try { return NextResponse.json({ files: await listAll(db) }, { headers }); }
    catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 500, headers }); }
  }

  if (t === "_auth") {
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: PAGE });
    if (error) return NextResponse.json({ error: error.message }, { status: 500, headers });
    const rows = data.users.map((u) => ({
      id: u.id, email: u.email, phone: u.phone || null, created_at: u.created_at, last_sign_in_at: u.last_sign_in_at,
      email_confirmed_at: u.email_confirmed_at, providers: u.app_metadata?.providers ?? [u.app_metadata?.provider].filter(Boolean),
      name: (u.user_metadata as { name?: string; full_name?: string } | null)?.name ?? (u.user_metadata as { full_name?: string } | null)?.full_name ?? null,
    }));
    return NextResponse.json({ rows, done: rows.length < PAGE }, { headers });
  }

  if (!(BACKUP_TABLES as readonly string[]).includes(t)) return NextResponse.json({ error: "Tabel tidak dikenal." }, { status: 400, headers });
  const from = Math.max(0, Number(url.searchParams.get("from")) || 0);
  const { data, error } = await db.from(t).select("*").range(from, from + PAGE - 1);
  // Tabel yang belum ada (migrasi belum dijalankan) dilewati, bukan menggagalkan backup
  if (error) return NextResponse.json({ rows: [], done: true, skipped: error.message }, { headers });
  const rows = Array.isArray(data) ? data : data ? [data] : [];
  return NextResponse.json({ rows, done: rows.length < PAGE }, { headers });
}
