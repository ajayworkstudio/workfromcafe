import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/admin/PageHeader";
import Flash from "@/components/admin/Flash";
import EventForm from "@/components/admin/EventForm";
import type { City } from "@/lib/types";

export default async function NewEvent({ searchParams }: { searchParams: Promise<{ err?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data: cities }, { data: cafes }] = await Promise.all([
    supabase.from("cities").select("*").order("name"),
    supabase.from("cafes").select("id,name,city:cities(name)").order("name"),
  ]);
  return (
    <>
      <Link href="/admin/event" className="text-sm font-medium text-muted hover:text-brand">← Semua event</Link>
      <PageHeader title="Buat event" />
      <Flash err={sp.err} />
      <EventForm cities={(cities as City[] | null) ?? []} cafes={(cafes as unknown as { id: string; name: string; city: { name: string } | null }[] | null) ?? []} />
    </>
  );
}
