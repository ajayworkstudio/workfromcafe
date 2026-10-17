import { NextResponse } from "next/server";
import { backupPhotosToDrive } from "@/lib/driveBackup";

export const maxDuration = 60;

/** Dijalankan harian oleh Vercel Cron (lihat vercel.json): backup foto Supabase ke Google Drive. */
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await backupPhotosToDrive());
  } catch (e) {
    return NextResponse.json({ status: "error", error: (e as Error).message }, { status: 500 });
  }
}
