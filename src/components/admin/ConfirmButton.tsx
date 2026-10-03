"use client";
import { useFormStatus } from "react-dom";

/** Tombol submit yang meminta konfirmasi dulu (untuk hapus, dll.). */
export default function ConfirmButton({ message, children, className = "btn-ghost", pendingText = "Memproses…" }:
  { message: string; children: React.ReactNode; className?: string; pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className={className} onClick={(e) => { if (!confirm(message)) e.preventDefault(); }}>
      {pending ? pendingText : children}
    </button>
  );
}
