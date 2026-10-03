"use client";
import dynamic from "next/dynamic";
import type { MapCafe } from "./CafeMap";

const CafeMap = dynamic(() => import("./CafeMap"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-muted/60">Memuat peta…</div>,
});

export default function CafeMapLoader({ cafes }: { cafes: MapCafe[] }) {
  return <CafeMap cafes={cafes} />;
}
