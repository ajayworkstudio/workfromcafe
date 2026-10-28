/** Pilihan topik di form kontak. Empat yang pertama juga tampil di Kotak saran. */
export const CONTACT_TOPICS = [
  { value: "bug", label: "Lapor bug", hint: "Ada yang error, tombol tidak jalan, atau tampilan berantakan." },
  { value: "koreksi", label: "Update kafe", hint: "Jam buka, harga, menu, atau info kafe yang sudah berubah." },
  { value: "platform", label: "Update platform", hint: "Usul fitur baru atau perbaikan untuk WFC Hunters." },
  { value: "kritik", label: "Saran & kritik", hint: "Apa pun yang bikin WFC Hunters lebih enak dipakai." },
  { value: "saran", label: "Kafe untuk diulas", hint: "Kafe yang menurutmu harus dicoba." },
  { value: "kafe_saya", label: "Aku pemilik kafe", hint: "Mau kafemu dicoba atau infonya dirapikan." },
  { value: "kerja_sama", label: "Kerja sama atau event", hint: "Kolaborasi, sponsor, atau acara." },
] as const;

/** Topik lama yang sudah tidak ditawarkan di form, tetap diberi label di admin. */
export const LEGACY_TOPIC_LABELS: Record<string, string> = { lainnya: "Lainnya" };

export const SUGGESTION_TOPICS = CONTACT_TOPICS.slice(0, 4);

export const topicLabel = (v: string) => CONTACT_TOPICS.find((t) => t.value === v)?.label ?? LEGACY_TOPIC_LABELS[v] ?? v;

export type ContactTopic = (typeof CONTACT_TOPICS)[number]["value"];

export type ContactState =
  | { ok: true; name: string }
  | { ok: false; error: string; field?: "name" | "email" | "body" | "topic" }
  | null;
