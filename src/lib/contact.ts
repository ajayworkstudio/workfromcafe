export const CONTACT_TOPICS = [
  { value: "saran", label: "Saran kafe untuk diulas" },
  { value: "kafe_saya", label: "Aku pemilik kafe" },
  { value: "koreksi", label: "Info kafe ada yang salah" },
  { value: "kerja_sama", label: "Kerja sama atau event" },
  { value: "lainnya", label: "Lainnya" },
] as const;

export type ContactTopic = (typeof CONTACT_TOPICS)[number]["value"];

export type ContactState =
  | { ok: true; name: string }
  | { ok: false; error: string; field?: "name" | "email" | "body" | "topic" }
  | null;
