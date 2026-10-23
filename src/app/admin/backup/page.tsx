import type { Metadata } from "next";
import PageHeader from "@/components/admin/PageHeader";
import BackupPanel from "@/components/admin/BackupPanel";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Backup" };

export default async function BackupPage() {
  await requireAdmin();
  return (
    <>
      <PageHeader title="Backup" description="Salinan data & foto WFC Hunters dalam satu file zip, untuk berjaga-jaga kalau Supabase dibatasi atau terjadi masalah." />
      <BackupPanel />
    </>
  );
}
