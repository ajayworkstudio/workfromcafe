import type { Metadata } from "next";
import ContactBox from "@/components/ContactBox";
import { CONTACT_TOPICS } from "@/lib/contact";
import { getViewer } from "@/lib/auth";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Kontak",
  description: "Kirim saran kafe untuk kerja, koreksi info kafe, atau tawaran kerja sama ke WFC Hunters.",
  alternates: { canonical: "/kontak" },
};

export default async function ContactPage({ searchParams }: { searchParams: Promise<{ topik?: string }> }) {
  const [{ topik }, viewer, settings] = await Promise.all([searchParams, getViewer(), getSettings()]);
  const topic = CONTACT_TOPICS.some((t) => t.value === topik) ? topik : undefined;
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 md:py-16">
      <div className="rounded-[2rem] border border-line bg-surface p-6 md:p-10">
        <ContactBox headingLevel="h1" defaultName={viewer.name} defaultEmail={viewer.user?.email}
          communityUrl={settings.community_url} defaultTopic={topic} />
      </div>
    </div>
  );
}
