import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <p className="text-6xl">☕</p>
      <h1 className="mt-4 font-display text-3xl font-bold">Halaman tidak ditemukan</h1>
      <p className="mt-2 text-bean/70">Mungkin kafenya sudah pindah alamat.</p>
      <Link href="/kafe" className="btn-dark mt-6">Jelajah kafe lain</Link>
    </div>
  );
}
