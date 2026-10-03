import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import AdminNav from "@/components/admin/AdminNav";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const v = await getViewer();
  if (!v.isAdmin) redirect("/");
  return (
    <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-6 px-4 py-6 md:grid-cols-[200px_minmax(0,1fr)] md:gap-10 md:py-10">
      <aside className="min-w-0 md:sticky md:top-24 md:self-start">
        <p className="mb-3 hidden px-3 text-sm font-semibold text-muted md:block">Panel admin</p>
        <AdminNav />
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
