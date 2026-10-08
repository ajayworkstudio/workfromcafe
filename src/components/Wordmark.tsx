import Image from "next/image";

/** Logo WFC Hunter (public/logo.png, rasio 744×518). */
export default function Wordmark({ height = 44, className = "" }: { height?: number; className?: string }) {
  const width = Math.round((height * 744) / 518);
  return <Image src="/logo.png" alt="WFC Hunter" width={width} height={height} priority className={`block h-auto ${className}`} style={{ height, width }} />;
}
