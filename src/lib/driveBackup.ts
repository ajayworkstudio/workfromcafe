import { createAdminClient } from "@/lib/supabase/server";

/**
 * Salin isi bucket `cafe-photos` ke satu folder Google Drive.
 * Hanya file yang belum ada di Drive yang diunggah (dicek lewat appProperties.sbPath),
 * dan file yang dihapus dari Supabase tetap disimpan di Drive.
 *
 * Butuh env: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN, GDRIVE_BACKUP_FOLDER_ID.
 * Pakai OAuth akun Google pemilik folder (bukan service account), karena service account
 * tidak punya kuota penyimpanan di Drive pribadi.
 */

const BUCKET = "cafe-photos";
const DRIVE = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3";

export type BackupResult =
  | { status: "off" }
  | { status: "ok"; uploaded: number; remaining: number; failed: string[] };

export function driveBackupConfigured() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_REFRESH_TOKEN &&
      process.env.GDRIVE_BACKUP_FOLDER_ID
  );
}

async function accessToken(): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN!,
      grant_type: "refresh_token",
    }),
  });
  const json = await res.json();
  if (!res.ok || !json.access_token) throw new Error(`Token Google ditolak: ${json.error ?? res.status}`);
  return json.access_token;
}

/** Semua path file di bucket. List Supabase tidak rekursif, jadi folder ditelusuri satu per satu. */
async function listStoragePaths(): Promise<string[]> {
  const db = createAdminClient();
  const paths: string[] = [];
  const queue = [""];
  while (queue.length) {
    const dir = queue.shift()!;
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await db.storage.from(BUCKET).list(dir, { limit: 1000, offset });
      if (error) throw error;
      for (const item of data ?? []) {
        const full = dir ? `${dir}/${item.name}` : item.name;
        if (item.id === null) queue.push(full); // folder
        else if (item.name !== ".emptyFolderPlaceholder") paths.push(full);
      }
      if (!data || data.length < 1000) break;
    }
  }
  return paths;
}

async function listDrivePaths(token: string, folderId: string): Promise<Set<string>> {
  const done = new Set<string>();
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed = false`,
      fields: "nextPageToken, files(appProperties)",
      pageSize: "1000",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
    });
    if (pageToken) params.set("pageToken", pageToken);
    const res = await fetch(`${DRIVE}/files?${params}`, { headers: { Authorization: `Bearer ${token}` } });
    const json = await res.json();
    if (!res.ok) throw new Error(`Gagal membaca folder Drive: ${json.error?.message ?? res.status}`);
    for (const f of json.files ?? []) if (f.appProperties?.sbPath) done.add(f.appProperties.sbPath);
    pageToken = json.nextPageToken;
  } while (pageToken);
  return done;
}

async function uploadToDrive(token: string, folderId: string, path: string, file: Blob) {
  const metadata = {
    name: path.replaceAll("/", "__"),
    parents: [folderId],
    appProperties: { sbPath: path },
  };
  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
  form.append("file", file);
  const res = await fetch(`${UPLOAD}/files?uploadType=multipart&supportsAllDrives=true&fields=id`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error?.message ?? String(res.status));
  }
}

/** Unggah file yang belum ter-backup sampai `budgetMs` habis; sisanya lanjut di jadwal berikutnya. */
export async function backupPhotosToDrive(budgetMs = 45_000): Promise<BackupResult> {
  if (!driveBackupConfigured()) return { status: "off" };
  const started = Date.now();
  const folderId = process.env.GDRIVE_BACKUP_FOLDER_ID!;
  const token = await accessToken();
  const [all, done] = await Promise.all([listStoragePaths(), listDrivePaths(token, folderId)]);
  const todo = all.filter((p) => !done.has(p));

  const db = createAdminClient();
  const failed: string[] = [];
  let uploaded = 0;
  for (const path of todo) {
    if (Date.now() - started > budgetMs) break;
    const { data, error } = await db.storage.from(BUCKET).download(path);
    if (error || !data) { failed.push(path); continue; }
    try {
      await uploadToDrive(token, folderId, path, data);
      uploaded++;
    } catch {
      failed.push(path);
    }
  }
  return { status: "ok", uploaded, remaining: todo.length - uploaded - failed.length, failed };
}
