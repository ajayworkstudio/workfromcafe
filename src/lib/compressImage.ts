/** Kompres gambar di browser sebelum diunggah (maks lebar 1600px, WebP ~80%). */
export async function compressImage(file: File, maxWidth = 1600, quality = 0.8): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxWidth / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Gagal kompres"))), "image/webp", quality)
  );
}

export function uniqueName(prefix: string) {
  return `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`;
}
