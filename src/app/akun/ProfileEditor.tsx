"use client";
import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { compressImage, uniqueName } from "@/lib/compressImage";
import Avatar from "@/components/Avatar";
import Icon from "@/components/Icon";
import { updateProfile, type ProfileState } from "./actions";

type Profile = { name: string | null; avatar_url: string | null; bio: string | null; instagram: string | null };

export default function ProfileEditor({ userId, email, profile, ready }: { userId: string; email?: string; profile: Profile; ready: boolean }) {
  const [state, action] = useActionState<ProfileState, FormData>(updateProfile, null);
  const [editing, setEditing] = useState(false);
  const [avatar, setAvatar] = useState(profile.avatar_url ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { if (state?.ok) setEditing(false); }, [state]);

  async function pick(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return setErr("Pilih file gambar.");
    setErr(null);
    setUploading(true);
    try {
      const supabase = createClient();
      const blob = await compressImage(file, 480, 0.85);
      const path = uniqueName(`avatars/${userId}`);
      const { error } = await supabase.storage.from("cafe-photos").upload(path, blob, { contentType: "image/webp" });
      if (error) throw new Error(/row-level|policy|security/i.test(error.message) ? "Unggah foto belum diizinkan. Admin perlu menjalankan migrasi 0009." : error.message);
      setAvatar(supabase.storage.from("cafe-photos").getPublicUrl(path).data.publicUrl);
      setEditing(true);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  const photoButton = (
    <label className={`group relative block w-fit shrink-0 cursor-pointer rounded-full ${uploading ? "animate-pulse" : ""}`} title="Ganti foto profil">
      <Avatar url={avatar || null} name={profile.name ?? email} className="h-24 w-24 text-3xl md:h-28 md:w-28" />
      <span className="absolute bottom-0.5 right-0.5 grid h-9 w-9 place-items-center rounded-full bg-ink text-white ring-4 ring-surface transition-transform group-hover:scale-105">
        <Icon name="image" className="h-4 w-4" />
      </span>
      <input type="file" accept="image/*" className="sr-only" disabled={uploading} onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
      <span className="sr-only">Ganti foto profil</span>
    </label>
  );

  return (
    <section className="card p-5 md:p-7">
      {!ready && <p className="mb-4 rounded-xl bg-gold/15 p-3 text-sm">Bio dan Instagram belum bisa disimpan: admin perlu menjalankan migrasi 0009 di Supabase.</p>}
      {!editing ? (
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          {photoButton}
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-3xl font-bold leading-tight">{profile.name || "Tanpa nama"}</h1>
            <p className="mt-0.5 flex flex-wrap gap-x-3 text-sm text-muted">
              <span>{email}</span>
              {profile.instagram && <a href={`https://instagram.com/${profile.instagram}`} target="_blank" rel="noopener" className="font-medium text-brand hover:underline">@{profile.instagram}</a>}
            </p>
            {profile.bio
              ? <p className="mt-3 max-w-xl whitespace-pre-line leading-relaxed text-ink/85">{profile.bio}</p>
              : <p className="mt-3 text-sm text-muted">Belum ada deskripsi. Ceritakan sedikit tentang dirimu, misalnya kerjaan atau kafe favoritmu.</p>}
          </div>
          <button type="button" onClick={() => setEditing(true)} className="btn-ghost self-start"><Icon name="edit" className="h-4 w-4" />Edit profil</button>
        </div>
      ) : (
        <form action={action} className="flex flex-col gap-6 sm:flex-row">
          <div className="flex flex-col items-center gap-2">
            {photoButton}
            {avatar && <button type="button" onClick={() => setAvatar("")} className="text-xs font-medium text-muted hover:text-[#b4533a]">Hapus foto</button>}
          </div>
          <input type="hidden" name="avatar_url" value={avatar} />
          <div className="min-w-0 flex-1 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="p_name" className="label">Nama</label>
                <input id="p_name" name="name" required maxLength={60} defaultValue={profile.name ?? ""} className="input" />
              </div>
              <div>
                <label htmlFor="p_ig" className="label">Instagram</label>
                <div className="flex items-center rounded-xl border border-line bg-surface focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/10">
                  <span className="pl-3.5 text-sm text-muted">@</span>
                  <input id="p_ig" name="instagram" maxLength={40} defaultValue={profile.instagram ?? ""} placeholder="username" className="w-full bg-transparent px-1.5 py-2.5 text-sm outline-none" />
                </div>
              </div>
            </div>
            <div>
              <div className="flex items-baseline justify-between">
                <label htmlFor="p_bio" className="label">Deskripsi</label>
                <span className={`text-xs tabular-nums ${bio.length > 280 ? "text-[#b4533a]" : "text-muted"}`}>{bio.length}/300</span>
              </div>
              <textarea id="p_bio" name="bio" rows={4} maxLength={300} value={bio} onChange={(e) => setBio(e.target.value)}
                placeholder="Contoh: Desainer lepas di Semarang. Suka kafe tenang dengan colokan dekat jendela." className="input" />
              <p className="mt-1 text-xs text-muted">Tampil di halaman kafe yang kamu rekomendasikan.</p>
            </div>
            {(err || state?.error) && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{err ?? state?.error}</p>}
            <div className="flex gap-2">
              <Save disabled={uploading} />
              <button type="button" onClick={() => { setEditing(false); setAvatar(profile.avatar_url ?? ""); setBio(profile.bio ?? ""); setErr(null); }} className="btn-ghost">Batal</button>
            </div>
          </div>
        </form>
      )}
      {!editing && err && <p role="alert" className="mt-4 text-sm text-[#b4533a]">{err}</p>}
      {!editing && state?.ok && <p role="status" className="mt-4 text-sm text-ok">{state.ok}</p>}
    </section>
  );
}

function Save({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return <button disabled={pending || disabled} className="btn-primary">{pending ? "Menyimpan…" : disabled ? "Mengunggah foto…" : "Simpan profil"}</button>;
}
