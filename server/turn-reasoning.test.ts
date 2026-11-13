import { describe, expect, it } from "vitest";

import { contextText } from "./delta-context.ts";
import { redactBotAuthored } from "./message-redaction.ts";
import { MAX_REASONING_CHARS, TurnReasoning } from "./turn-reasoning.ts";

describe("TurnReasoning", () => {
  it("accumulates deltas for a turn and yields them once on take", () => {
    const tr = new TurnReasoning();
    tr.reset("t1", "turn-1");
    tr.append("t1", "turn-1", "Let me ");
    tr.append("t1", "turn-1", "check.");
    expect(tr.take("t1", "turn-1")).toBe("Let me check.");
    expect(tr.take("t1", "turn-1")).toBeUndefined();
  });

  it("inserts a paragraph break when a tool phase separates two thinking bursts", () => {
    const tr = new TurnReasoning();
    tr.reset("t1", "turn-1");
    tr.append("t1", "turn-1", "First thought.");
    tr.breakPhase("t1", "turn-1");
    tr.append("t1", "turn-1", "Second thought.");
    expect(tr.take("t1", "turn-1")).toBe("First thought.\n\nSecond thought.");
  });

  it("does not leave trailing blank lines when no thinking follows a tool phase", () => {
    const tr = new TurnReasoning();
    tr.reset("t1", "turn-1");
    tr.append("t1", "turn-1", "Before tool.");
    tr.breakPhase("t1", "turn-1");
    expect(tr.take("t1", "turn-1")).toBe("Before tool.");
  });

  it("isolates turns so stale reasoning never bleeds across turn boundaries", () => {
    const tr = new TurnReasoning();
    tr.reset("t1", "turn-1");
    tr.append("t1", "turn-1", "Old turn");
    expect(tr.take("t1", "turn-2")).toBeUndefined();
    tr.append("t1", "turn-2", "New turn");
    expect(tr.take("t1", "turn-2")).toBe("New turn");
  });

  it("returns undefined for whitespace-only reasoning and bounds growth", () => {
    const tr = new TurnReasoning();
    tr.append("t1", "turn-1", "   \n  ");
    expect(tr.take("t1", "turn-1")).toBeUndefined();

    tr.append("t1", "turn-2", "a".repeat(MAX_REASONING_CHARS + 500));
    expect(tr.take("t1", "turn-2")?.length).toBe(MAX_REASONING_CHARS);
  });

  it("redacts secrets in bot reasoning and leaves reasoning out of model context replay", () => {
    const scrubbed = redactBotAuthored({
      role: "bot",
      kind: "text",
      text: "Here is the answer.",
      reasoning: "Saw key sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJ while thinking.",
    });
    expect(scrubbed.reasoning).not.toContain("abcdefghijklmnopqrstuvwxyz0123456789");
    expect(contextText(scrubbed)).toBe("Here is the answer.");
  });
});
