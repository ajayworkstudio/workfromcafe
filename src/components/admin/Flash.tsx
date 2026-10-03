/** Pesan singkat setelah aksi admin (dibaca dari ?ok= atau ?err= di URL). */
export default function Flash({ ok, err }: { ok?: string; err?: string }) {
  if (!ok && !err) return null;
  return (
    <p role={err ? "alert" : "status"}
      className={`mb-5 rounded-xl px-4 py-3 text-sm ${err ? "border border-red-200 bg-red-50 text-red-800" : "bg-brand-soft text-brand-dark"}`}>
      {err ?? ok}
    </p>
  );
}
