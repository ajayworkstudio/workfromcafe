/*
  Cakupan wilayah WorkFromCafe.
  Saat ini prioritas kota-kota besar di Pulau Jawa; daftar provinsi bisa ditambah kapan saja.
*/

export const REGION_LABEL = "Pulau Jawa";

export const PROVINCES = ["DKI Jakarta", "Banten", "Jawa Barat", "Jawa Tengah", "DI Yogyakarta", "Jawa Timur"] as const;

/** Titik tengah peta default (Pulau Jawa). */
export const MAP_CENTER: [number, number] = [-7.2, 110.0];

/** Tebak provinsi di Jawa dari koordinat (perkiraan kasar, bisa dikoreksi di Admin → Kota). */
export function guessProvince(lat: number | null | undefined, lng: number | null | undefined): string {
  if (lat == null || lng == null) return "Jawa Tengah";
  if (lat > -6.38 && lat < -6.05 && lng > 106.74 && lng < 106.95) return "DKI Jakarta";
  if (lat > -8.25 && lat < -7.62 && lng > 110.0 && lng < 110.85) return "DI Yogyakarta";
  if (lng < 106.1) return "Banten";
  if (lng < 106.8 && lat > -6.4) return "Banten"; // Tangerang dan sekitarnya
  if (lng < 108.85) return "Jawa Barat";
  if (lng < 111.7) return "Jawa Tengah";
  return "Jawa Timur";
}
