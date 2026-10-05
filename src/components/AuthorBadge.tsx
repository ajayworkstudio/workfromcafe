import Icon from "./Icon";
import { levelFor } from "@/lib/author";

export default function AuthorBadge({ count, className = "" }: { count: number; className?: string }) {
  const { current } = levelFor(count);
  if (!current) return null;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${current.className} ${className}`}>
      <Icon name={current.icon} filled={current.icon === "star"} className="h-3 w-3" />{current.name}
    </span>
  );
}
