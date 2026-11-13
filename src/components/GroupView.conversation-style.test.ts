// @vitest-environment happy-dom
import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Bot, Group, Message } from "@/state/store";
import type { ConversationStyle } from "@/lib/feature-flags";

const fixture = vi.hoisted(() => ({ style: "bubbles" as ConversationStyle }));

vi.mock("@/state/store", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/state/store")>();
  return {
    ...original,
    useStore: () => ({
      state: {
        ...original.initialState,
        bots: [] as Bot[],
        config: { features: { conversationStyle: fixture.style } },
      },
      dispatch: vi.fn(),
    }),
  };
});
vi.mock("./DesktopCapabilities", async (importOriginal) => ({
  ...await importOriginal<typeof import("./DesktopCapabilities")>(),
  useDesktopCapabilities: () => ({ capabilities: { dictation: { available: false }, host: { packaged: true, platform: "other" }, localComputer: { available: false, reasonCode: "x", message: "" } }, ready: true }),
  useCaptionChrome: () => ({}),
}));
vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));
vi.mock("@/lib/cloud-guest", () => ({ useCanWriteIn: () => true, useReactor: () => "user" }));

const { Transcript } = await import("./GroupView");

const lead = { id: "lead", name: "Lead", color: "blue" } as Bot;
const messages: Message[] = [
  { id: "u1", role: "user", kind: "text", at: 1, text: "Status?" },
  { id: "b1", role: "bot", kind: "text", at: 2, text: "All checks green.", from: { botId: "lead", name: "Lead", color: "blue" } },
];
const room: Group = {
  id: "room",
  threadId: "room-thread",
  name: "Launch",
  memberIds: ["lead"],
  defaultResponder: { kind: "member", botId: "lead" },
  bulletin: "",
  unread: false,
  createdAt: 1,
  messages,
};

let host: HTMLDivElement;
let root: Root;

function render() {
  flushSync(() =>
    root.render(createElement(Transcript, { group: room, members: [lead], locale: "en", messages, transcript: messages, onReply: vi.fn() })),
  );
}

beforeEach(() => {
  fixture.style = "bubbles";
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  flushSync(() => root.unmount());
  host.remove();
});

describe("GroupView conversation style", () => {
  it("switches room messages between classic bubbles and OpenChamber prose layout", () => {
    render();
    expect(host.querySelector('[data-mid="b1"] [data-chat-bubble]')?.className).toContain("bg-card");

    fixture.style = "openchamber";
    render();
    const botBubble = host.querySelector('[data-mid="b1"] [data-chat-bubble]')!;
    const userBubble = host.querySelector('[data-mid="u1"] [data-chat-bubble]')!;
    expect(botBubble.getAttribute("data-chat-bubble")).toBe("openchamber");
    expect(botBubble.className).not.toContain("bg-card");
    expect(botBubble.className).toContain("w-full");
    expect(userBubble.getAttribute("data-chat-bubble")).toBe("openchamber");
    expect(userBubble.className).toContain("bg-bubble-user");
    expect(userBubble.className).toContain("rounded-ee-[6px]");
    expect(botBubble.parentElement?.className).toContain("flex-col");
    expect(botBubble.nextElementSibling?.querySelector('[data-testid="message-actions"]')).not.toBeNull();
  });
});
