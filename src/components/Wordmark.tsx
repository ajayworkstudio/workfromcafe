/** Logo WorkFromCafe versi satu baris untuk header (warna sama dengan logo resmi). */
export default function Wordmark({ className = "text-[20px]" }: { className?: string }) {
  return (
    <span className={`font-logo font-extrabold uppercase leading-none tracking-[-0.02em] ${className}`} aria-label="WorkFromCafe">
      <span className="text-brand">Work</span>
      <span className="text-tan">From</span>
      <span className="text-brand">Cafe</span>
    </span>
  );
}
