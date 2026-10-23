/*
  Foto kafe lewat CDN Vercel: /foto/<path> mengambil file dari bucket Supabase `cafe-photos` sekali,
  lalu disimpan di cache CDN Vercel selama setahun. Pengunjung berikutnya dilayani dari CDN, jadi kuota
  Cached Egress Supabase hampir tidak terpakai. Aman di-cache lama karena setiap unggahan punya nama file baru.
*/
const BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/cafe-photos/`;
const YEAR = 60 * 60 * 24 * 365;

export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  // Hanya nama file/folder biasa (huruf, angka, titik, minus, garis bawah); tidak ada ".." atau garis miring tersembunyi
  if (!path?.length || path.some((p) => !/^[\w.-]+$/.test(p) || p.startsWith(".."))) return new Response("Not found", { status: 404 });

  const upstream = await fetch(BASE + path.map(encodeURIComponent).join("/"), { cache: "no-store" });
  if (!upstream.ok || !upstream.body) {
    return new Response("Not found", { status: upstream.status === 404 || upstream.status === 400 ? 404 : 502, headers: { "Cache-Control": "public, max-age=60" } });
  }
  const type = upstream.headers.get("content-type") ?? "application/octet-stream";
  if (!type.startsWith("image/")) return new Response("Not found", { status: 404 });

  return new Response(upstream.body, {
    headers: {
      "Content-Type": type,
      ...(upstream.headers.get("content-length") ? { "Content-Length": upstream.headers.get("content-length")! } : {}),
      "Cache-Control": `public, max-age=${YEAR}, immutable`,
      "CDN-Cache-Control": `public, max-age=${YEAR}, immutable`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
