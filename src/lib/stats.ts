// Statistik pengunjung halaman kafe (migrasi 0026). Dipakai di admin, dashboard owner, dan laporan.

export const EVENT_KINDS = ["view", "maps", "menu", "instagram", "share", "whatsapp"] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

export const ACTION_LABEL: Record<Exclude<EventKind, "view">, string> = {
  maps: "Buka rute di Maps",
  menu: "Lihat menu",
  instagram: "Buka Instagram",
  share: "Bagikan",
  whatsapp: "Hubungi via WhatsApp",
};

export type Source = "wfc" | "google" | "sosial" | "whatsapp" | "langsung" | "lain";
export const SOURCE_LABEL: Record<Source, string> = {
  google: "Google & mesin pencari",
  wfc: "Dari dalam WFC Hunters",
  sosial: "Instagram, TikTok & media sosial",
  whatsapp: "Dibagikan lewat WhatsApp",
  langsung: "Langsung (link tersimpan)",
  lain: "Situs lain",
};

export type CafeStats = {
  days: number;
  views: number;
  visitors: number;
  prev_views: number;
  prev_visitors: number;
  actions: Partial<Record<Exclude<EventKind, "view">, number>>;
  prev_actions: number;
  sources: Partial<Record<Source, number>>;
  devices: { hp?: number; desktop?: number };
  logged_in: number;
  cities: { city: string; n: number }[];
  daily: { d: string; views: number; visitors: number }[];
  favorites: number;
  hours: Record<string, number>;
};

export type OverviewRow = {
  cafe_id: string; name: string; slug: string; city: string | null;
  views: number; visitors: number; actions: number; prev_views: number; favorites: number; has_owner: boolean;
};

export const PERIODS = [7, 30, 90] as const;
export const periodOf = (v?: string) => (PERIODS as readonly number[]).includes(Number(v)) ? Number(v) : 30;

export const sumActions = (s: CafeStats) => Object.values(s.actions).reduce((a, b) => a + (b ?? 0), 0);

/** Perubahan dibanding periode sebelumnya, dalam persen. null kalau periode sebelumnya kosong. */
export function change(now: number, before: number) {
  if (!before) return null;
  return Math.round(((now - before) / before) * 100);
}

/** Jam paling ramai (WIB) dari sebaran tampilan per jam, misalnya "13.00 sampai 15.00". */
export function busiestWindow(hours: Record<string, number>) {
  let best = -1, at = -1;
  for (let h = 0; h < 24; h++) {
    const n = (hours[h] ?? 0) + (hours[(h + 1) % 24] ?? 0);
    if (n > best) { best = n; at = h; }
  }
  if (best <= 0) return null;
  const f = (h: number) => `${String(h % 24).padStart(2, "0")}.00`;
  return `${f(at)} sampai ${f(at + 2)}`;
}

// ---------- dipakai di server (route /api/lihat) ----------

const BOT = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|whatsapp|telegram|discord|preview|headless|lighthouse|pingdom|uptime|curl|wget|python|axios|node-fetch/i;
export const isBot = (ua: string) => !ua || BOT.test(ua);

export const deviceOf = (ua: string) => (/mobi|android|iphone|ipad|ipod/i.test(ua) ? "hp" : "desktop");

/** Asal kunjungan dari referrer (atau utm_source kalau link diberi tanda). */
export function sourceOf(referrer: string, utm: string, ownHost: string): Source {
  const u = utm.toLowerCase();
  if (u) {
    if (/wa|whatsapp/.test(u)) return "whatsapp";
    if (/ig|insta|tiktok|fb|facebook|threads|twitter|x\b|sosial|social/.test(u)) return "sosial";
    if (/google|seo/.test(u)) return "google";
  }
  if (!referrer) return "langsung";
  let host = "";
  try { host = new URL(referrer).hostname.replace(/^www\./, ""); } catch { return "lain"; }
  if (host === ownHost.replace(/^www\./, "") || host.endsWith(".vercel.app")) return "wfc";
  if (/(^|\.)(google|bing|duckduckgo|yahoo|ecosia|yandex|search\.brave)\./.test(host) || host.startsWith("google.")) return "google";
  if (/(instagram|facebook|fb\.|tiktok|threads|t\.co$|x\.com$|twitter|linkedin|pinterest|youtube)/.test(host)) return "sosial";
  if (/whatsapp|wa\.me/.test(host)) return "whatsapp";
  return "lain";
}
