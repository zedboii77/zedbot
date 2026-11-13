import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";

import { launchVerificationServer, runControlOmb } from "../scripts/control-omb.ts";
import type { WireBot, WireMessage } from "../shared/wire.ts";
import { LIVE_REPLY_CASES, liveReplyScripts } from "./testing/live-reply-cases.ts";

it("persists streamed thinking per message across tools, redacts secrets, and exposes thinking settings", async () => {
  const scratch = mkdtempSync(join(tmpdir(), "omb-turn-reasoning-"));
  const scripts = join(scratch, "scripts.json");
  const scriptsData = {
    ...liveReplyScripts(LIVE_REPLY_CASES),
    "#secret-think": [
      { think: "Checking key sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJ quietly." },
      { say: "Safe reply." },
    ],
  };
  writeFileSync(scripts, JSON.stringify(scriptsData));

  const fixture = await launchVerificationServer({
    ...process.env,
    FAKE_STREAM_SCRIPT: scripts,
    FAKE_STREAM_CADENCE: "6:5",
  });
  const { url } = fixture.info;
  const api = async <T = any>(path: string, method = "GET", body?: unknown, status = 200): Promise<T> => {
    const response = await fetch(url + path, {
      method,
      headers: { "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    expect(response.status, `${method} ${path}`).toBe(status);
    return response.json() as Promise<T>;
  };

  try {
    const initial = await api<{ features: { showReasoning: boolean; reasoningCollapse: string } }>("/api/config");
    expect(initial.features.showReasoning).toBe(false);
    expect(initial.features.reasoningCollapse).toBe("auto");

    const updated = await api<{ features: { showReasoning: boolean; reasoningCollapse: string } }>("/api/config", "PATCH", {
      features: { showReasoning: true, reasoningCollapse: "manual" },
    });
    expect(updated.features.showReasoning).toBe(true);
    expect(updated.features.reasoningCollapse).toBe("manual");

    const { bot } = await api<{ bot: WireBot }>("/api/bots", "POST", {}, 201);
    const botMessages = async () =>
      ((await api<{ bots: Array<WireBot & { messages: WireMessage[] }> }>("/api/bots")).bots.find((candidate) => candidate.id === bot.id)?.messages ?? []);
    await runControlOmb(["send", "--bot", bot.id, "--task", bot.threadId, "--text", "Please answer #case-think", "--url", url]);
    expect(await runControlOmb(["wait", "--bot", bot.id, "--task", bot.threadId, "--timeout", "30", "--url", url])).toMatchObject({ status: "settled" });

    const messages = await botMessages();
    const botTexts = messages.filter((message) => message.role === "bot" && message.kind === "text" && message.turnId);
    expect(botTexts.map((message) => message.text)).toEqual(["T11M1 the answer is yes.", "T11M2 confirmed."]);
    expect(botTexts.map((message) => message.reasoning)).toEqual([
      "THINK11A weighing the options quietly.",
      "THINK11B checking once more.",
    ]);

    await runControlOmb(["send", "--bot", bot.id, "--task", bot.threadId, "--text", "Check #secret-think", "--url", url]);
    expect(await runControlOmb(["wait", "--bot", bot.id, "--task", bot.threadId, "--timeout", "30", "--url", url])).toMatchObject({ status: "settled" });

    const afterSecret = (await botMessages())
      .filter((message) => message.role === "bot" && message.kind === "text")
      .at(-1)!;
    expect(afterSecret.text).toBe("Safe reply.");
    expect(afterSecret.reasoning).toBeDefined();
    expect(afterSecret.reasoning).not.toContain("abcdefghijklmnopqrstuvwxyz0123456789");
  } finally {
    await fixture.close();
    rmSync(scratch, { recursive: true, force: true });
  }
}, 60_000);
