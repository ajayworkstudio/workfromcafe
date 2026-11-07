import Icon from "./Icon";
import { levelFor } from "@/lib/author";
import { getT } from "@/lib/i18n/server";

export default async function AuthorBadge({ count, className = "" }: { count: number; className?: string }) {
  const { t } = await getT();
  const { current } = levelFor(count);
  if (!current) return null;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${current.className} ${className}`}>
      <Icon name={current.icon} filled={current.icon === "star"} className="h-3 w-3" />{t(current.name)}
    </span>
  );
}
