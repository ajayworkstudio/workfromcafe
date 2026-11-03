"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { notifyOwnerMessage } from "@/lib/notify";

export async function sendAdminReply(f: FormData) {
  const admin = await requireAdmin();
  const cafeId = String(f.get("cafe_id") ?? "");
  const body = String(f.get("body") ?? "").trim().slice(0, 2000);
  const back = (q = "") => redirect(`/admin/owner-chat/${cafeId}${q}`);
  if (!body) back("?err=Pesannya+masih+kosong.");
  const { error } = await (await createClient()).from("owner_messages").insert({ cafe_id: cafeId, sender_id: admin.user!.id, from_admin: true, body });
  if (error) back(`?err=${encodeURIComponent(`Gagal mengirim: ${error.message}`)}`);
  after(() => notifyOwnerMessage(cafeId, true, body));
  revalidatePath("/admin/owner-chat");
  back();
}
