"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginForm({ next }: { next: string }) {
  const supabase = createClient();
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "daftar">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const redirectTo = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMsg("Email atau kata sandi salah.");
      else { router.push(next); router.refresh(); }
    } else {
      const { error } = await supabase.auth.signUp({
        email, password, options: { emailRedirectTo: redirectTo(), data: { full_name: name } },
      });
      setMsg(error ? error.message : "Cek email kamu untuk konfirmasi pendaftaran.");
    }
    setLoading(false);
  }

  return (
    <div className="mt-6 space-y-4">
      <button
        onClick={() => supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirectTo() } })}
        className="btn-ghost w-full"
      >
        <span className="font-bold text-terra">G</span> Lanjut dengan Google
      </button>
      <div className="flex items-center gap-3 text-xs text-bean/50"><hr className="flex-1 border-roast/10" />atau<hr className="flex-1 border-roast/10" /></div>
      <form onSubmit={submit} className="space-y-3">
        {mode === "daftar" && (
          <input required placeholder="Nama" value={name} onChange={(e) => setName(e.target.value)} className="input" />
        )}
        <input required type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
        <input required type="password" minLength={6} placeholder="Kata sandi" value={password} onChange={(e) => setPassword(e.target.value)} className="input" />
        <button disabled={loading} className="btn-dark w-full">{loading ? "Memproses…" : mode === "login" ? "Masuk" : "Daftar"}</button>
      </form>
      {msg && <p className="text-sm text-bean">{msg}</p>}
      <p className="text-center text-sm">
        {mode === "login" ? "Belum punya akun? " : "Sudah punya akun? "}
        <button onClick={() => setMode(mode === "login" ? "daftar" : "login")} className="font-semibold text-terra">
          {mode === "login" ? "Daftar" : "Masuk"}
        </button>
      </p>
    </div>
  );
}
