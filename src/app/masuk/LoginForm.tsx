"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

export default function LoginForm({ next }: { next: string }) {
  const supabase = createClient();
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "daftar">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<{ type: "error" | "info"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const redirectTo = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  async function google() {
    setGoogleLoading(true);
    setMsg(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirectTo(), queryParams: { prompt: "select_account" } },
    });
    if (error) {
      setGoogleLoading(false);
      setMsg({ type: "error", text: "Login Google belum aktif. Pastikan provider Google sudah dinyalakan di Supabase." });
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMsg({ type: "error", text: "Email atau kata sandi tidak cocok." });
      else { router.push(next); router.refresh(); }
    } else {
      const { error } = await supabase.auth.signUp({
        email, password, options: { emailRedirectTo: redirectTo(), data: { full_name: name } },
      });
      setMsg(error ? { type: "error", text: error.message } : { type: "info", text: `Link konfirmasi sudah dikirim ke ${email}. Buka email itu untuk mengaktifkan akun.` });
    }
    setLoading(false);
  }

  return (
    <div className="mt-8">
      <button onClick={google} disabled={googleLoading}
        className="btn w-full border border-line bg-surface !py-3 text-[15px] hover:border-mist hover:bg-tint">
        <GoogleLogo />
        {googleLoading ? "Mengarahkan ke Google…" : "Masuk dengan Google"}
      </button>

      <div className="my-6 flex items-center gap-3 text-sm text-muted">
        <span className="h-px flex-1 bg-line" />atau pakai email<span className="h-px flex-1 bg-line" />
      </div>

      <form onSubmit={submit} className="space-y-3">
        {mode === "daftar" && (
          <div>
            <label htmlFor="name" className="label">Nama</label>
            <input id="name" required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className="input" />
          </div>
        )}
        <div>
          <label htmlFor="email" className="label">Email</label>
          <input id="email" required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
        </div>
        <div>
          <label htmlFor="password" className="label">Kata sandi</label>
          <input id="password" required type="password" minLength={6} autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={password} onChange={(e) => setPassword(e.target.value)} className="input" />
        </div>
        <button disabled={loading} className="btn-dark w-full !py-3">
          {loading ? "Memproses…" : mode === "login" ? "Masuk" : "Buat akun"}
        </button>
      </form>

      {msg && (
        <p role={msg.type === "error" ? "alert" : "status"}
          className={`mt-4 rounded-xl p-3 text-sm ${msg.type === "error" ? "border border-red-200 bg-red-50 text-red-800" : "bg-brand-soft text-brand"}`}>
          {msg.text}
        </p>
      )}

      <p className="mt-6 text-center text-sm text-muted">
        {mode === "login" ? "Belum punya akun? " : "Sudah punya akun? "}
        <button onClick={() => { setMode(mode === "login" ? "daftar" : "login"); setMsg(null); }} className="font-semibold text-brand hover:underline">
          {mode === "login" ? "Daftar dengan email" : "Masuk"}
        </button>
      </p>
    </div>
  );
}
