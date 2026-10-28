import type { Metadata } from "next";
import ContactBox from "@/components/ContactBox";
import { CONTACT_TOPICS } from "@/lib/contact";
import { getViewer } from "@/lib/auth";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Kotak saran & kontak",
  description: "Lapor bug, update info kafe, usul fitur, atau kirim saran dan kritik ke WFC Hunters lewat form, email, atau DM Instagram.",
  alternates: { canonical: "/kontak" },
};

/** Email publik untuk tombol "Kirim lewat email": CONTACT_EMAIL, atau alamat pengirim email situs. */
function contactEmail() {
  const raw = process.env.CONTACT_EMAIL || process.env.SMTP_USER || process.env.EMAIL_FROM || "";
  return raw.match(/[^\s<>"]+@[^\s<>"]+\.[^\s<>"]+/)?.[0] ?? null;
}

export default async function ContactPage({ searchParams }: { searchParams: Promise<{ topik?: string }> }) {
  const [{ topik }, viewer, settings] = await Promise.all([searchParams, getViewer(), getSettings()]);
  const topic = CONTACT_TOPICS.some((t) => t.value === topik) ? topik : undefined;
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 md:py-16">
      <div id="pesan" className="scroll-mt-24 rounded-[2rem] border border-line bg-surface p-6 md:p-10">
        <ContactBox headingLevel="h1" defaultName={viewer.name} defaultEmail={viewer.user?.email}
          communityUrl={settings.community_url} defaultTopic={topic} contactEmail={contactEmail()} />
      </div>
    </div>
  );
}
