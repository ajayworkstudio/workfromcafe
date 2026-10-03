import type { Metadata } from "next";
import LoginForm from "./LoginForm";

export const metadata: Metadata = { title: "Masuk" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <div className="mx-auto max-w-sm px-4 py-14">
      <h1 className="font-display text-3xl font-bold">Masuk</h1>
      <p className="mt-1 text-sm text-bean/70">Simpan kafe favorit dan buka ulasan lengkap.</p>
      {error && <p className="mt-4 rounded-xl bg-terra/10 p-3 text-sm text-terra-dark">Gagal masuk, coba lagi.</p>}
      <LoginForm next={next?.startsWith("/") ? next : "/"} />
    </div>
  );
}
