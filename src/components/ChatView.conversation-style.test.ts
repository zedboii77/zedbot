// @vitest-environment happy-dom
import { act, createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppState, Bot, InstanceInfo, Message } from "@/state/store";
import type { ConversationStyle } from "@/lib/feature-flags";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const fixture = vi.hoisted(() => ({
  phone: false,
  advanced: false,
  colorMine: false,
}));

vi.mock("./ChatMarkdown", async (importOriginal) => ({
  ...await importOriginal<typeof import("./ChatMarkdown")>(),
  ChatMarkdown: ({ text }: { text: string }) => createElement("div", { className: "chat-md" }, text),
}));
vi.mock("./DesktopCapabilities", async (importOriginal) => ({
  ...await importOriginal<typeof import("./DesktopCapabilities")>(),
  useDesktopCapabilities: () => ({ capabilities: { dictation: { available: false }, host: { packaged: true, platform: "other" }, localComputer: { available: false } }, ready: true }),
}));
vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));
vi.mock("@/lib/cloud-guest", () => ({ useCanWriteIn: () => true, useReactor: () => "user" }));
vi.mock("@/lib/interface-mode", () => ({ useAdvancedMode: () => fixture.advanced, setAdvancedMode: vi.fn() }));
vi.mock("@/lib/user-bubble-preference", () => ({ useColorUserBubbles: () => fixture.colorMine }));
vi.mock("@/lib/use-media-query", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/use-media-query")>();
  return {
    ...original,
    useMediaQuery: (query: string) => (query === original.PHONE_LAYOUT ? fixture.phone : false),
  };
});
vi.mock("./ModelPicker", () => ({ ModelPicker: () => null }));

const { ChatView } = await import("./ChatView");
const { BotEditorStore, initialState } = await import("@/state/store");
const { noteLiveReplyEvent, noteLiveReplyMessage, resetLiveReplies } = await import("@/state/live-reply");
const { resetTurnLive } = await import("@/state/turn-status");

const messages: Message[] = [
  { id: "u1", role: "user", kind: "text", at: 1, text: "Check all servers" },
  {
    id: "b1",
    parentId: "u1",
    role: "bot",
    kind: "text",
    at: 2,
    reasoning: "Inspecting hosts",
    text: "Everything checked out live just now across all machines.",
  },
  {
    id: "b2",
    parentId: "b1",
    role: "bot",
    kind: "text",
    at: 3,
    text: "| Host | Status |\n| --- | --- |\n| node-1 | ok |",
  },
];

const bot: Bot = {
  id: "bot",
  threadId: "thread-1",
  name: "Hydrogen",
  title: "",
  description: "",
  color: "blue",
  notifications: true,
  unread: false,
  busy: false,
  messages,
  activeLeafId: "b2",
  modelSelection: { instanceId: "test", model: "m" },
  tasks: [{ threadId: "thread-1", title: "Main", createdAt: 1, busy: false, activity: "idle", modelSelection: { instanceId: "test", model: "m" }, approvalMode: "ask" }],
};

let host: HTMLDivElement;
let root: Root;

function draw(style: ConversationStyle, extraMessages?: Message[]) {
  const activeBot = extraMessages ? { ...bot, messages: extraMessages, activeLeafId: extraMessages.at(-1)?.id } : bot;
  const state: AppState = {
    ...initialState,
    connected: true,
    selectedId: activeBot.id,
    bots: [activeBot],
    instances: [{ instanceId: "test", driverKind: "codex", displayName: "Test", models: { options: [] }, snapshot: { state: "available" } } as unknown as InstanceInfo],
    config: { features: { conversationStyle: style, showReasoning: true } } as AppState["config"],
  };
  const value = { state, dispatch: vi.fn(), flushBotPatches: async () => null, refreshInstances: async () => {}, refreshModels: async () => {} };
  flushSync(() => root.render(createElement(BotEditorStore, { value, children: createElement(ChatView, { bot: activeBot }) })));
}

beforeEach(() => {
  fixture.phone = false;
  fixture.advanced = false;
  fixture.colorMine = false;
  resetTurnLive();
  resetLiveReplies();
  vi.stubGlobal("fetch", () => new Promise(() => {}));
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  flushSync(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("ChatView conversation style", () => {
  it("renders classic bubbles by default and OpenChamber full-width prose + bottom actions when enabled", () => {
    draw("bubbles");
    const bubbleBot = host.querySelector('[data-mid="b1"] [data-chat-bubble]')!;
    expect(bubbleBot.getAttribute("data-chat-bubble")).toBe("simple");
    expect(bubbleBot.className).toContain("bg-card");

    draw("openchamber");
    const ocUser = host.querySelector('[data-mid="u1"] [data-chat-bubble]')!;
    const ocBot = host.querySelector('[data-mid="b1"] [data-chat-bubble]')!;
    const ocTableBot = host.querySelector('[data-mid="b2"] [data-chat-bubble]')!;

    expect(ocUser.getAttribute("data-chat-bubble")).toBe("openchamber");
    expect(ocUser.className).toContain("bg-bubble-user");
    expect(ocUser.className).toContain("max-w-[min(85%,var(--chat-bubble-max))]");
    expect(ocUser.className).toContain("rounded-ee-[6px]");

    expect(ocBot.getAttribute("data-chat-bubble")).toBe("openchamber");
    expect(ocBot.className).not.toContain("bg-card");
    expect(ocBot.className).toContain("w-full");
    expect(ocBot.className).toContain("max-w-[var(--chat-prose-max)]");

    expect(ocTableBot.className).toContain("chat-wide");
    expect(ocTableBot.className).toContain("w-full");
    expect(host.querySelector('[data-mid="b2"] [data-reply-blocks]')).toBeNull();

    const userRow = host.querySelector('[data-mid="u1"] [data-message-row]')!;
    const botRow = host.querySelector('[data-mid="b1"] [data-message-row]')!;
    expect(userRow.querySelector('[data-testid="message-actions"]')?.hasAttribute("data-touch-actions")).toBe(true);
    expect(botRow.querySelector('[data-testid="message-actions"]')?.hasAttribute("data-touch-actions")).toBe(true);
    // Actions live below the bubble in a vertical column wrapper, not horizontally beside the text.
    expect(ocBot.parentElement?.className).toContain("flex-col");
    expect(ocBot.nextElementSibling?.querySelector('[data-testid="message-actions"]')).not.toBeNull();
    // Inline Copy & Reply stay directly reachable in OpenChamber even in Simple mode.
    expect(botRow.querySelector('[aria-label="Reply to message"]')).not.toBeNull();
    expect(botRow.querySelector('[aria-label="Copy message"]')).not.toBeNull();
  });

  it("activates OpenChamber only on mobile viewports when set to mobile", () => {
    fixture.phone = false;
    draw("mobile");
    expect(host.querySelector('[data-mid="b1"] [data-chat-bubble]')?.getAttribute("data-chat-bubble")).toBe("simple");

    fixture.phone = true;
    draw("mobile");
    expect(host.querySelector('[data-mid="b1"] [data-chat-bubble]')?.getAttribute("data-chat-bubble")).toBe("openchamber");
    expect(host.querySelector(".glass-scroller")?.className).toContain("max-md:px-3.5");
  });

  it("supports bot-colored user bubbles in OpenChamber mode", () => {
    fixture.colorMine = true;
    draw("openchamber");
    const ocUser = host.querySelector('[data-mid="u1"] [data-chat-bubble]')!;
    expect(ocUser.className).toContain("user-bubble-colored");
  });

  it("keeps live streaming and settled markup identical in OpenChamber mode", () => {
    const started = Date.UTC(2026, 10, 11, 12, 0, 0);
    vi.useFakeTimers({ now: started + 5_000 });
    const base: Message[] = [{ id: "u1", role: "user", kind: "text", at: started, text: "Hi" }];
    const looks = (el: Element) => el.outerHTML.replace(/live:[^"]+|data-mid="[^"]+"|data-citation-source="[^"]+"/g, "");

    act(() => noteLiveReplyEvent({ eventId: "e1", provider: "codex", threadId: "thread-1", createdAt: new Date(started + 5_000).toISOString(), turnId: "t1", type: "turn.started" } as never));
    draw("openchamber", base);
    act(() => noteLiveReplyEvent({ eventId: "e2", provider: "codex", threadId: "thread-1", createdAt: new Date(started + 5_000).toISOString(), turnId: "t1", type: "content.delta", streamKind: "assistant_text", delta: "Done." } as never));
    act(() => noteLiveReplyEvent({ eventId: "e3", provider: "codex", threadId: "thread-1", createdAt: new Date(started + 5_000).toISOString(), turnId: "t1", type: "item.completed", itemType: "assistant_text", text: "Done." } as never));

    const liveRow = host.querySelector('[data-mid^="live:"]')!;
    expect(liveRow.querySelector('[data-testid="message-actions"]')?.hasAttribute("inert")).toBe(true);
    const liveHtml = looks(liveRow).replace(/ inert=""/g, "");

    const saved: Message = { id: "m-done", parentId: "u1", role: "bot", kind: "text", at: started + 5_000, text: "Done.", turnId: "t1" };
    act(() => noteLiveReplyMessage("thread-1", saved));
    draw("openchamber", [...base, saved]);
    const savedRow = host.querySelector('[data-mid="m-done"]')!;
    expect(looks(savedRow).replace(/ inert=""/g, "")).toBe(liveHtml);
  });
});
