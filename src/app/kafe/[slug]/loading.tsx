import { Bone } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-10 pt-6" role="status" aria-label="Memuat kafe">
      <div className="grid gap-2 md:grid-cols-[2fr_1fr]">
        <Bone className="aspect-[16/10] !rounded-[var(--radius-photo)] md:aspect-auto md:h-[420px]" />
        <div className="hidden gap-2 md:grid md:grid-rows-2"><Bone className="!rounded-[var(--radius-photo)]" /><Bone className="!rounded-[var(--radius-photo)]" /></div>
      </div>
      <div className="mt-8 grid gap-10 md:grid-cols-[1fr_320px]">
        <div>
          <Bone className="h-4 w-40" />
          <Bone className="mt-3 h-12 w-3/4" />
          <Bone className="mt-4 h-4 w-1/2" />
          <Bone className="mt-6 h-6 w-full max-w-2xl" />
          <Bone className="mt-2 h-6 w-4/5 max-w-xl" />
          <div className="mt-6 flex gap-2"><Bone className="h-10 w-28 !rounded-full" /><Bone className="h-10 w-40 !rounded-full" /><Bone className="h-10 w-44 !rounded-full" /></div>
          <Bone className="mt-12 h-72 w-full !rounded-3xl" />
        </div>
        <div className="space-y-3"><Bone className="h-5 w-24" /><Bone className="h-5 w-full" /><Bone className="mt-4 h-48 w-full" /></div>
      </div>
    </div>
  );
}
