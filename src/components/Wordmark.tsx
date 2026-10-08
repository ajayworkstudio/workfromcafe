import Image from "next/image";

// Ukuran asli public/logo.png (lebar × tinggi) untuk menjaga rasio
const LOGO_W = 802;
const LOGO_H = 518;

/** Logo WFC Hunters. */
export default function Wordmark({ height = 44, className = "" }: { height?: number; className?: string }) {
  const width = Math.round((height * LOGO_W) / LOGO_H);
  return <Image src="/logo.png" alt="WFC Hunters" width={width} height={height} priority className={`block h-auto ${className}`} style={{ height, width }} />;
}
