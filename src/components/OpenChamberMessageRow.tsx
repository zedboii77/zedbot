import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import { formatTime } from "@/state/store";

export function OpenChamberMessageRow({
  user,
  at,
  actions,
  children,
}: {
  user: boolean;
  at: number;
  actions: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex w-full min-w-0 flex-col", user ? "items-end" : "items-start")}>
      {children}
      <div className={cn("mt-1 flex w-full items-center gap-2", user ? "justify-end" : "justify-start")}>
        {user ? (
          <>
            <span className="text-[11px] tabular-nums text-ink-tertiary opacity-0 transition-opacity group-hover:opacity-100 touch:opacity-75 group-focus-within:opacity-100">
              {formatTime(at)}
            </span>
            {actions}
          </>
        ) : (
          <>
            {actions}
            <span className="text-[11px] tabular-nums text-ink-tertiary opacity-0 transition-opacity group-hover:opacity-100 touch:opacity-75 group-focus-within:opacity-100">
              {formatTime(at)}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
