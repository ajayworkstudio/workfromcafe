import type { MetadataRoute } from "next";
import { APP_NAME } from "@/lib/utils";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${APP_NAME} — Kurasi Kafe Jawa Tengah`,
    short_name: APP_NAME,
    description: "Koleksi kafe pilihan di Jawa Tengah dan menu yang wajib dicoba.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f2ee",
    theme_color: "#6b4226",
    lang: "id",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
