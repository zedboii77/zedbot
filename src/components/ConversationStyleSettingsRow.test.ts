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

import { ConversationStyleRow } from "./AppSettingsRows";

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  setLocale("en");
  vi.clearAllMocks();
  fixture.config = { features: { conversationStyle: "bubbles" } };
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  flushSync(() => root.unmount());
  host.remove();
});

const render = () => {
  flushSync(() => root.render(createElement(ConversationStyleRow)));
};

describe("conversation style settings row", () => {
  it("renders Bubbles, OpenChamber, and Mobile options with the active selection checked", () => {
    render();
    const radios = [...host.querySelectorAll<HTMLButtonElement>('[role="radio"]')];
    expect(radios.map((radio) => radio.textContent)).toEqual(["Bubbles", "OpenChamber", "Mobile"]);
    expect(radios.map((radio) => radio.getAttribute("aria-checked"))).toEqual(["true", "false", "false"]);

    fixture.config = { features: { conversationStyle: "openchamber" } };
    render();
    expect([...host.querySelectorAll<HTMLButtonElement>('[role="radio"]')].map((radio) => radio.getAttribute("aria-checked")))
      .toEqual(["false", "true", "false"]);
  });

  it("patches features.conversationStyle via /api/config and dispatches updated config", async () => {
    fixture.api.mockImplementation(async (_url: string, init: { body: string }) => ({
      features: { ...JSON.parse(init.body).features },
    }));
    render();

    const radios = [...host.querySelectorAll<HTMLButtonElement>('[role="radio"]')];
    await (async () => {
      radios[1]!.click();
      await Promise.resolve();
      await Promise.resolve();
    })();

    expect(fixture.api).toHaveBeenCalledWith("/api/config", {
      method: "PATCH",
      body: JSON.stringify({ features: { conversationStyle: "openchamber" } }),
    });
    expect(fixture.dispatch).toHaveBeenCalledWith({
      type: "configStatus",
      config: { features: { conversationStyle: "openchamber" } },
    });

    fixture.config = { features: { conversationStyle: "openchamber" } };
    render();
    const mobileRadio = [...host.querySelectorAll<HTMLButtonElement>('[role="radio"]')][2]!;
    await (async () => {
      mobileRadio.click();
      await Promise.resolve();
      await Promise.resolve();
    })();

    expect(fixture.api).toHaveBeenCalledWith("/api/config", {
      method: "PATCH",
      body: JSON.stringify({ features: { conversationStyle: "mobile" } }),
    });
  });

  it("shows an inline alert if saving fails", async () => {
    fixture.api.mockRejectedValueOnce(new Error("save failed"));
    render();

    const openChamberRadio = [...host.querySelectorAll<HTMLButtonElement>('[role="radio"]')][1]!;
    await (async () => {
      openChamberRadio.click();
      await Promise.resolve();
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    })();

    expect(host.querySelector('[role="alert"]')?.textContent).toBe("save failed");
  });
});
