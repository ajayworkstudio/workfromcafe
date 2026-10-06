import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/admin/PageHeader";
import Flash from "@/components/admin/Flash";
import EventForm from "@/components/admin/EventForm";
import ConfirmButton from "@/components/admin/ConfirmButton";
import { deleteEvent } from "../actions";
import { EVENT_SELECT, type WfcEvent } from "@/lib/events";
import type { City } from "@/lib/types";

export default async function EditEvent({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; err?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  const [{ data: event }, { data: cities }, { data: cafes }] = await Promise.all([
    supabase.from("events").select(EVENT_SELECT).eq("id", id).maybeSingle(),
    supabase.from("cities").select("*").order("name"),
    supabase.from("cafes").select("id,name,city:cities(name)").order("name"),
  ]);
  if (!event) notFound();
  const e = event as WfcEvent;
  return (
    <>
      <Link href="/admin/event" className="text-sm font-medium text-muted hover:text-brand">← Semua event</Link>
      <PageHeader title={e.title} action={<Link href={`/event/${e.slug}`} className="btn-ghost">Lihat halaman</Link>} />
      <Flash ok={sp.ok} err={sp.err} />
      <EventForm event={e} cities={(cities as City[] | null) ?? []} cafes={(cafes as unknown as { id: string; name: string; city: { name: string } | null }[] | null) ?? []} />
      <form action={deleteEvent} className="mt-8">
        <input type="hidden" name="id" value={e.id} />
        <ConfirmButton message="Hapus event ini?">Hapus event</ConfirmButton>
      </form>
    </>
  );
}
