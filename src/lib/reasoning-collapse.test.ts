import { afterEach, describe, expect, it } from "vitest";

import {
  getReasoningOverride,
  resetReasoningOverrides,
  setReasoningOverride,
  transferReasoningOverride,
} from "./reasoning-collapse";

afterEach(() => resetReasoningOverrides());

describe("reasoning block collapse overrides", () => {
  it("remembers explicit open and close overrides and carries them across live-to-saved swap", () => {
    expect(getReasoningOverride("live:k1")).toBeUndefined();
    setReasoningOverride("live:k1", true);
    expect(getReasoningOverride("live:k1")).toBe(true);
    transferReasoningOverride("live:k1", "msg-1");
    expect(getReasoningOverride("live:k1")).toBeUndefined();
    expect(getReasoningOverride("msg-1")).toBe(true);
  });

  it("does nothing when transferring a key without an override", () => {
    transferReasoningOverride("live:missing", "msg-2");
    expect(getReasoningOverride("msg-2")).toBeUndefined();
  });
});
