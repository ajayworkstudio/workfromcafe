"use client";
import Icon from "./Icon";

export default function PrintButton({ label = "Cetak atau simpan PDF" }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className="btn-primary min-h-11">
      <Icon name="book" className="h-4 w-4" />{label}
    </button>
  );
}
