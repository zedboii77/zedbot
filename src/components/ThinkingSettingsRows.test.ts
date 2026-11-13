// @vitest-environment happy-dom
import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setLocale } from "@/lib/i18n";

const fixture = vi.hoisted(() => ({
  config: null as unknown,
  dispatch: vi.fn(),
  api: vi.fn(),
}));

vi.mock("@/state/store", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/state/store")>();
  return {
    ...original,
    api: fixture.api,
    useStore: () => ({ state: { ...original.initialState, config: fixture.config }, dispatch: fixture.dispatch }),
  };
});

import { ThinkingBlocksRow, ThinkingCollapseRow } from "./AppSettingsRows";

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  setLocale("en");
  vi.clearAllMocks();
  fixture.config = { features: { showReasoning: false, reasoningCollapse: "auto" } };
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  flushSync(() => root.unmount());
  host.remove();
});

const render = () => {
  flushSync(() =>
    root.render(createElement("div", null, createElement(ThinkingBlocksRow), createElement(ThinkingCollapseRow))),
  );
};

describe("thinking settings rows", () => {
  it("disables the collapse mode radios while Thinking is off, and enables them once on", () => {
    render();
    const toggle = host.querySelector<HTMLButtonElement>('[role="switch"]')!;
    const radios = [...host.querySelectorAll<HTMLButtonElement>('[role="radio"]')];
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    expect(radios.map((radio) => radio.disabled)).toEqual([true, true]);

    fixture.config = { features: { showReasoning: true, reasoningCollapse: "manual" } };
    render();
    expect(host.querySelector<HTMLButtonElement>('[role="switch"]')!.getAttribute("aria-checked")).toBe("true");
    const active = [...host.querySelectorAll<HTMLButtonElement>('[role="radio"]')];
    expect(active.map((radio) => radio.disabled)).toEqual([false, false]);
    expect(active.map((radio) => radio.getAttribute("aria-checked"))).toEqual(["false", "true"]);
  });

  it("patches showReasoning and reasoningCollapse via /api/config and dispatches updated config", async () => {
    fixture.api.mockImplementation(async (_url: string, init: { body: string }) => ({
      features: { showReasoning: true, reasoningCollapse: "manual", ...JSON.parse(init.body).features },
    }));
    fixture.config = { features: { showReasoning: false, reasoningCollapse: "auto" } };
    render();

    await (async () => {
      host.querySelector<HTMLButtonElement>('[role="switch"]')!.click();
      await Promise.resolve();
      await Promise.resolve();
    })();

    expect(fixture.api).toHaveBeenCalledWith("/api/config", {
      method: "PATCH",
      body: JSON.stringify({ features: { showReasoning: true } }),
    });
    expect(fixture.dispatch).toHaveBeenCalledWith({
      type: "configStatus",
      config: { features: { showReasoning: true, reasoningCollapse: "manual" } },
    });

    fixture.config = { features: { showReasoning: true, reasoningCollapse: "auto" } };
    render();
    const manualRadio = [...host.querySelectorAll<HTMLButtonElement>('[role="radio"]')][1]!;
    await (async () => {
      manualRadio.click();
      await Promise.resolve();
      await Promise.resolve();
    })();

    expect(fixture.api).toHaveBeenCalledWith("/api/config", {
      method: "PATCH",
      body: JSON.stringify({ features: { reasoningCollapse: "manual" } }),
    });
  });
});
