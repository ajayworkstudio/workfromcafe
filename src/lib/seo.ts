import { APP_NAME, SITE_URL } from "./utils";

export const abs = (path: string) => (path.startsWith("http") ? path : `${SITE_URL}${path.startsWith("/") ? "" : "/"}${path}`);

/** Potong teks untuk meta description (±155 karakter) tanpa memotong kata. */
export function clip(text: string, max = 155) {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1).replace(/\s+\S*$/, "") + "…";
}

export function breadcrumb(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: abs(it.path) })),
  };
}

export const ORGANIZATION = {
  "@type": "Organization",
  "@id": `${SITE_URL}/#organization`,
  name: APP_NAME,
  url: SITE_URL,
  logo: abs("/logo.png"),
};

/** Halaman yang tidak perlu muncul di Google. */
export const NO_INDEX = { index: false, follow: false } as const;
