import { memo, useEffect, useRef } from "react";
import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";
import { setReasoningOverride, useReasoningOverride } from "@/lib/reasoning-collapse";
import { WorkingDots } from "./WorkingIndicator";

export interface ReasoningBlockProps {
  messageId: string;
  text: string;
  thinking?: boolean;
  collapseMode?: "auto" | "manual";
}

export const ReasoningBlock = memo(function ReasoningBlock({
  messageId,
  text,
  thinking = false,
  collapseMode = "auto",
}: ReasoningBlockProps) {
  const override = useReasoningOverride(messageId);
  const open = override ?? (collapseMode === "manual" ? true : thinking);
  const bodyRef = useRef<HTMLDivElement>(null);
  const stickBottomRef = useRef(true);

  useEffect(() => {
    const el = bodyRef.current;
    if (!thinking || !open || !el || !stickBottomRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [text, thinking, open]);

  return (
    <div
      className={cn(
        "mb-2 max-w-full rounded-xl border border-hairline/40 bg-panel/75 px-3 py-2 text-left",
        open ? "w-full min-w-[min(18rem,100%)]" : "w-fit",
      )}
      data-testid="reasoning-block"
      data-reasoning-open={open ? "true" : "false"}
    >
      <button
        type="button"
        onClick={() => setReasoningOverride(messageId, !open)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center gap-1.5 text-[12px] font-medium text-ink-secondary transition-colors hover:text-ink"
      >
        <ChevronRight
          size={12}
          aria-hidden="true"
          className={cn("shrink-0 transition-transform duration-150", open && "rotate-90")}
        />
        <span>{t("chat.thinking")}</span>
        {thinking && <WorkingDots size={3.5} className="ml-0.5 text-ink-tertiary" />}
      </button>
      {open && (
        <div
          ref={bodyRef}
          dir="auto"
          onScroll={(event) => {
            const el = event.currentTarget;
            stickBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
          }}
          className="mt-1.5 max-h-60 overflow-y-auto whitespace-pre-wrap break-words text-[12.5px] leading-5 text-ink-secondary select-text"
        >
          {text.trimEnd()}
        </div>
      )}
    </div>
  );
});
