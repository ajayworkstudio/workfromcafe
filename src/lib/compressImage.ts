/**
 * Kompres gambar di browser sebelum diunggah ke Supabase Storage.
 * Ini satu-satunya tahap kompresi: optimasi gambar Vercel dimatikan (lihat next.config.ts),
 * jadi file yang tersimpan di sini yang langsung dikirim ke pengunjung.
 * `maxSide` membatasi sisi terpanjang, supaya foto potret juga ikut kecil.
 */
export async function compressImage(file: File, maxSide = 1440, quality = 0.75): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Gagal kompres"))), "image/webp", quality)
  );
}

export function uniqueName(prefix: string) {
  return `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`;
}
