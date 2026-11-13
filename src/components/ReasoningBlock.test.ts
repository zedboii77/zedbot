// @vitest-environment happy-dom
import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { setLocale } from "@/lib/i18n";
import { resetReasoningOverrides } from "@/lib/reasoning-collapse";
import { ReasoningBlock } from "./ReasoningBlock";

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  setLocale("en");
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  flushSync(() => root.unmount());
  host.remove();
  resetReasoningOverrides();
});

const render = (props: Parameters<typeof ReasoningBlock>[0]) => {
  flushSync(() => root.render(createElement(ReasoningBlock, props)));
};

const button = () => host.querySelector("button")!;
const block = () => host.querySelector('[data-testid="reasoning-block"]')!;

describe("ReasoningBlock", () => {
  it("opens while thinking and auto-collapses when thinking ends in auto mode", () => {
    render({ messageId: "m1", text: "Weighing options...", thinking: true, collapseMode: "auto" });
    expect(block().getAttribute("data-reasoning-open")).toBe("true");
    expect(button().getAttribute("aria-expanded")).toBe("true");
    expect(host.textContent).toContain("Weighing options...");

    render({ messageId: "m1", text: "Weighing options...", thinking: false, collapseMode: "auto" });
    expect(block().getAttribute("data-reasoning-open")).toBe("false");
    expect(button().getAttribute("aria-expanded")).toBe("false");
    expect(host.textContent).not.toContain("Weighing options...");
  });

  it("stays open after thinking ends in manual mode until toggled by the user", () => {
    render({ messageId: "m2", text: "Checking step by step.", thinking: true, collapseMode: "manual" });
    expect(block().getAttribute("data-reasoning-open")).toBe("true");

    render({ messageId: "m2", text: "Checking step by step.", thinking: false, collapseMode: "manual" });
    expect(block().getAttribute("data-reasoning-open")).toBe("true");
    expect(host.textContent).toContain("Checking step by step.");

    flushSync(() => button().click());
    expect(block().getAttribute("data-reasoning-open")).toBe("false");
    expect(host.textContent).not.toContain("Checking step by step.");
  });

  it("preserves a user's manual expand choice in auto mode", () => {
    render({ messageId: "m3", text: "Thought process.", thinking: false, collapseMode: "auto" });
    expect(block().getAttribute("data-reasoning-open")).toBe("false");

    flushSync(() => button().click());
    expect(block().getAttribute("data-reasoning-open")).toBe("true");
    expect(host.textContent).toContain("Thought process.");
  });
});
