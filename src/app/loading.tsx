import { Bone, CardGridSkeleton } from "@/components/Skeleton";

/** Tampil seketika saat pindah halaman, sementara server menyiapkan isinya. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10" role="status" aria-label="Memuat">
      <Bone className="h-10 w-2/3 max-w-md" />
      <Bone className="mt-3 h-5 w-1/2 max-w-sm" />
      <div className="mt-8"><CardGridSkeleton /></div>
    </div>
  );
}
