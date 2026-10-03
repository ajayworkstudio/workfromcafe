import { cache } from "react";
import { createClient } from "./supabase/server";

export type Viewer = {
  user: { id: string; email?: string } | null;
  isAdmin: boolean;
  isPremium: boolean;
  premiumUntil: string | null;
  /** Paket yang sedang aktif (paling lama berakhir): "trial" | "monthly" | "yearly" */
  plan: string | null;
  name: string | null;
};

/** Info pengguna yang sedang melihat halaman. Di-cache per request supaya Header & halaman tidak query dua kali. */
export const getViewer = cache(async (): Promise<Viewer> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, isAdmin: false, isPremium: false, premiumUntil: null, plan: null, name: null };

  const [{ data: profile }, { data: sub }] = await Promise.all([
    supabase.from("profiles").select("role,name").eq("id", user.id).maybeSingle(),
    supabase
      .from("subscriptions")
      .select("end_date,plan")
      .eq("user_id", user.id)
      .eq("status", "active")
      .gt("end_date", new Date().toISOString())
      .order("end_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    user: { id: user.id, email: user.email },
    isAdmin: profile?.role === "admin",
    isPremium: !!sub,
    premiumUntil: sub?.end_date ?? null,
    plan: sub?.plan ?? null,
    name: profile?.name ?? null,
  };
});

/** Pastikan pemanggil admin (dipakai di server action admin). */
export async function requireAdmin() {
  const v = await getViewer();
  if (!v.isAdmin) throw new Error("Hanya admin");
  return v;
}
