import { PostStatus } from "@prisma/client";
import { statusLabel, statusColor } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function StatusBadge({ status }: { status: PostStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        statusColor(status)
      )}
    >
      {statusLabel(status)}
    </span>
  );
}
