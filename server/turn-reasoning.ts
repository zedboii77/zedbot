export const MAX_REASONING_CHARS = 128_000;

interface Entry {
  turnId: string | undefined;
  text: string;
  needsBreak: boolean;
}

export class TurnReasoning {
  readonly #byThread = new Map<string, Entry>();

  reset(threadId: string, turnId: string | undefined): void {
    this.#byThread.set(threadId, { turnId, text: "", needsBreak: false });
  }

  append(threadId: string, turnId: string | undefined, delta: string): void {
    if (!delta) return;
    let entry = this.#byThread.get(threadId);
    if (!entry || (entry.turnId !== undefined && turnId !== undefined && entry.turnId !== turnId)) {
      entry = { turnId, text: "", needsBreak: false };
      this.#byThread.set(threadId, entry);
    } else if (entry.turnId === undefined && turnId !== undefined) {
      entry.turnId = turnId;
    }
    if (entry.needsBreak) {
      entry.needsBreak = false;
      if (entry.text && !entry.text.endsWith("\n\n")) {
        const sep = entry.text.endsWith("\n") ? "\n" : "\n\n";
        const room = MAX_REASONING_CHARS - entry.text.length;
        if (room >= sep.length) entry.text += sep;
      }
    }
    const room = MAX_REASONING_CHARS - entry.text.length;
    if (room > 0) entry.text += delta.length <= room ? delta : delta.slice(0, room);
  }

  breakPhase(threadId: string, turnId: string | undefined): void {
    const entry = this.#byThread.get(threadId);
    if (!entry || !entry.text) return;
    if (entry.turnId !== undefined && turnId !== undefined && entry.turnId !== turnId) return;
    entry.needsBreak = true;
  }

  take(threadId: string, turnId: string | undefined): string | undefined {
    const entry = this.#byThread.get(threadId);
    if (!entry) return undefined;
    if (entry.turnId !== undefined && turnId !== undefined && entry.turnId !== turnId) return undefined;
    this.#byThread.delete(threadId);
    return entry.text.trim() ? entry.text.trimEnd() : undefined;
  }

  clear(threadId: string): void {
    this.#byThread.delete(threadId);
  }

  onEvent(
    event: {
      type: string;
      threadId: string;
      turnId?: string;
      streamKind?: string;
      delta?: string;
      itemType?: string;
      terminal?: boolean;
    },
    liveTurnId: string | undefined,
  ): void {
    switch (event.type) {
      case "turn.started":
        this.reset(event.threadId, event.turnId);
        break;
      case "content.delta":
        if (event.streamKind === "reasoning_text" && event.delta) this.append(event.threadId, liveTurnId, event.delta);
        break;
      case "item.started":
        if (event.itemType === "tool") this.breakPhase(event.threadId, liveTurnId);
        break;
      case "runtime.error":
        if (event.terminal === true) this.clear(event.threadId);
        break;
      case "cap.exhausted":
      case "session.exited":
      case "turn.completed":
        this.clear(event.threadId);
        break;
    }
  }
}
