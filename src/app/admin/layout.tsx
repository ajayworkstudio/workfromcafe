import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const v = await getViewer();
  if (!v.isAdmin) redirect("/");
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <span className="mr-2 font-display text-xl font-bold">Admin</span>
        <Link href="/admin" className="btn-ghost !py-1.5">Ringkasan</Link>
        <Link href="/admin/kafe" className="btn-ghost !py-1.5">Kafe</Link>
        <Link href="/admin/kota" className="btn-ghost !py-1.5">Kota</Link>
        <Link href="/admin/pelanggan" className="btn-ghost !py-1.5">Pelanggan</Link>
        <Link href="/admin/kafe/baru" className="btn-primary !py-1.5 ml-auto">+ Kafe baru</Link>
      </div>
      {children}
    </div>
  );
}
