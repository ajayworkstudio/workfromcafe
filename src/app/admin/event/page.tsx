import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import PageHeader from "@/components/admin/PageHeader";
import Flash from "@/components/admin/Flash";
import EventCard from "@/components/EventCard";
import Icon from "@/components/Icon";
import { EVENT_SELECT, type WfcEvent } from "@/lib/events";

export default async function EventsAdmin({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const [sp, settings] = await Promise.all([searchParams, getSettings()]);
  const supabase = await createClient();
  const { data, error } = await supabase.from("events").select(EVENT_SELECT).order("starts_at", { ascending: false });
  const events = (data as WfcEvent[] | null) ?? [];
  return (
    <>
      <PageHeader title="Event" description="Buat dan kelola event. Selama menu Event belum dibuka, umum hanya melihat tulisan “Segera”."
        action={<Link href="/admin/event/baru" className="btn-primary"><Icon name="plus" className="h-4 w-4" />Buat event</Link>} />
      <Flash ok={sp.ok} err={sp.err ?? (error ? "Tabel event belum ada. Jalankan migrasi 0013_event.sql di Supabase." : undefined)} />
      <div className={`mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl px-5 py-4 text-sm ${settings.events_public ? "bg-ok/10" : "border border-gold/60 bg-gold/10"}`}>
        <span>{settings.events_public ? <><b>Menu Event terbuka untuk umum.</b> Event yang tayang bisa dilihat semua orang.</> : <><b>Menu Event masih terkunci.</b> Umum melihat &quot;Segera&quot;, hanya admin yang bisa melihat event.</>}</span>
        <span className="flex gap-2">
          <Link href="/event" className="btn-ghost !py-1.5">Lihat halaman</Link>
          <Link href="/admin/pengaturan" className="btn-dark !py-1.5">{settings.events_public ? "Pengaturan" : "Buka untuk umum"}</Link>
        </span>
      </div>
      {events.length ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {events.map((e) => (
            <div key={e.id} className="relative">
              <EventCard e={e} past={new Date(e.ends_at ?? e.starts_at).getTime() < Date.now()} />
              <Link href={`/admin/event/${e.id}`} className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-surface shadow" aria-label={`Edit ${e.title}`}><Icon name="edit" className="h-4 w-4" /></Link>
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">Belum ada event.</p>
      )}
    </>
  );
}
