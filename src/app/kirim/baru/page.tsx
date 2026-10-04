import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth";
import type { City } from "@/lib/types";
import SubmitForm from "./SubmitForm";

export const metadata: Metadata = { title: "Kirim rekomendasi kafe" };

export default async function NewSubmissionPage() {
  const viewer = await getViewer();
  if (!viewer.user) redirect("/masuk?next=/kirim/baru");
  const supabase = await createClient();
  const { data: cities } = await supabase.from("cities").select("*").order("name");

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/kirim" className="text-sm font-medium text-muted hover:text-brand">← Rekomendasi saya</Link>
      <h1 className="mt-3 text-4xl font-extrabold leading-tight">Kirim rekomendasi kafe</h1>
      <p className="mt-2 max-w-xl text-muted">
        Isi sebanyak yang kamu tahu. Yang wajib cuma nama, kota, lokasi, dan ulasan singkat. Admin akan mengecek dan merapikan sebelum ditayangkan.
      </p>
      <div className="mt-8">
        <SubmitForm userId={viewer.user.id} defaultName={viewer.name ?? ""} cities={(cities as City[] | null) ?? []} />
      </div>
    </div>
  );
}
