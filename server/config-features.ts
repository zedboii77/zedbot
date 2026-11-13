import { z } from "zod";

export const DEFAULT_SKILL_REVIEW_STEPS = 10;
export const MIN_SKILL_REVIEW_STEPS = 3;
export const MAX_SKILL_REVIEW_STEPS = 100;
export const AUTO_UPDATE_DISABLE_ENV = "OMB_DISABLE_AUTO_UPDATE";

export type ConversationStyle = "bubbles" | "openchamber" | "mobile";

// Not strict: a stale client's unknown flag must be dropped, not fail the whole config.
export const featureConfigSchema = z.object({
  /** Bots may draft skills for your review. On unless false. */
  skillAuthoring: z.boolean().optional(),
  /** The bot's engine reviews long conversations and updates its learned skills. Off unless true; needs skillAuthoring. */
  skillReview: z.boolean().optional(),
  /** Tool steps in one conversation between automatic reviews. */
  skillReviewSteps: z.number().int().min(3).max(100).optional(),
  /** Show each tool run in the transcript. Off unless explicitly enabled. */
  showToolCalls: z.boolean().optional(),
  /** Show the model's thinking blocks in chat. Off unless explicitly enabled. */
  showReasoning: z.boolean().optional(),
  /** Auto-collapse thinking blocks once the reply starts, or keep them manual. */
  reasoningCollapse: z.enum(["auto", "manual"]).optional(),
  /** Chat message layout: classic bubbles, OpenChamber clean prose, or OpenChamber on mobile screens. */
  conversationStyle: z.enum(["bubbles", "openchamber", "mobile"]).optional(),
  /** Background AI engine auto-updates and release update checks. On unless false or OMB_DISABLE_AUTO_UPDATE=1. */
  autoUpdate: z.boolean().optional(),
  /** Built-in browser. On unless false; each bot also has its own switch. */
  browser: z.boolean().optional(),
  /** Computer sharing. Off unless true, set by hand: there is no Settings toggle. */
  sharedComputers: z.boolean().optional(),
  claudeUserMcp: z.boolean().optional(), // Claude bots also load this machine's Claude Code MCP servers. Off unless true: tools cost tokens.
  claudeUserSkills: z.boolean().optional(), // Claude bots also load the skills in ~/.claude/skills, in place. Off unless true.
  /** LLM-generated titles for new threads. Off unless true. */
  llmThreadTitles: z.boolean().optional(),
  /** A new bot's setup card offers answers its engine writes for it, when there is something to go on. On unless false. */
  smartSetupChoices: z.boolean().optional(),
  /** Recall matching passages from the bot's memory into each turn. On unless false. */
  autoRecall: z.boolean().optional(),
  /** One shared skills store that bots read by assignment. Off unless true. */
  skillsLibrary: z.boolean().optional(),
  shareLearnedSkills: z.enum(["off", "ask", "auto"]).optional(),
  /** Memory upkeep also reads a member bot's room turns. Off unless true. */
  roomMemoryCapture: z.boolean().optional(),
  /** Room jobs to several members run side by side, each in a thread of its own. Off unless true. */
  parallelRoomJobs: z.boolean().optional(),
  acpPlanLines: z.boolean().optional(), // An ACP agent's plan as activity lines. Off unless true.
}).extend({
  agentsToolBridge: z.boolean().optional(),
  savedSteps: z.boolean().optional(),
  usbPhoneTakeover: z.boolean().optional(),
  cloudComputerAutoReplace: z.boolean().optional(),
});

export type FeatureConfig = z.output<typeof featureConfigSchema>;
type WithFeatures = { features?: FeatureConfig };

export function skillAuthoringEnabled(cfg: WithFeatures): boolean {
  return cfg.features?.skillAuthoring !== false;
}

export function skillReviewEnabled(cfg: WithFeatures): boolean {
  return skillAuthoringEnabled(cfg) && cfg.features?.skillReview === true;
}

export function skillReviewSteps(cfg: WithFeatures): number {
  const raw = cfg.features?.skillReviewSteps;
  const value = typeof raw === "number" && Number.isFinite(raw) ? Math.round(raw) : DEFAULT_SKILL_REVIEW_STEPS;
  return Math.min(MAX_SKILL_REVIEW_STEPS, Math.max(MIN_SKILL_REVIEW_STEPS, value));
}

export function autoRecallEnabled(cfg: WithFeatures): boolean {
  return cfg.features?.autoRecall !== false;
}

export function roomMemoryCaptureEnabled(cfg: WithFeatures): boolean {
  return cfg.features?.roomMemoryCapture === true;
}

export function showToolCallsEnabled(cfg: WithFeatures): boolean {
  return cfg.features?.showToolCalls === true;
}

export function showReasoningEnabled(cfg: WithFeatures): boolean {
  return cfg.features?.showReasoning === true;
}

export function reasoningCollapseMode(cfg: WithFeatures): "auto" | "manual" {
  return cfg.features?.reasoningCollapse === "manual" ? "manual" : "auto";
}

export function conversationStyleMode(cfg: WithFeatures): ConversationStyle {
  const style = cfg.features?.conversationStyle;
  return style === "openchamber" || style === "mobile" ? style : "bubbles";
}

export function autoUpdateEnabled(cfg: WithFeatures, env: NodeJS.ProcessEnv = process.env): boolean {
  return env[AUTO_UPDATE_DISABLE_ENV] !== "1" && cfg.features?.autoUpdate !== false;
}

export function builtInBrowserEnabled(cfg: WithFeatures, _env: NodeJS.ProcessEnv = process.env): boolean {
  return cfg.features?.browser !== false;
}

/** Security: every paired session may lend its computer only when true, because a read-only folder grant can still be escalated to a shell. */
export function sharedComputersEnabled(cfg: WithFeatures): boolean { return cfg.features?.sharedComputers === true; }
/** A self-hosted server's own admin pairings may lend their computer unless this is false (each desktop asks its person first). */
export function ownerLendingEnabled(cfg: WithFeatures): boolean { return cfg.features?.sharedComputers !== false; }

export function claudeUserMcpEnabled(cfg: WithFeatures): boolean {
  return cfg.features?.claudeUserMcp === true;
}

export function configFeaturesStatus(cfg: WithFeatures, extra: {
  skillsLibrary: boolean;
  shareLearnedSkills: "off" | "ask" | "auto";
  claudeUserSkills: boolean;
  parallelRoomJobs: boolean;
  llmThreadTitles: boolean;
  savedSteps: boolean;
  savedStepsHere: boolean;
  usbPhoneTakeover?: boolean;
}) {
  return {
    skillAuthoring: skillAuthoringEnabled(cfg),
    skillReview: cfg.features?.skillReview === true,
    skillReviewSteps: skillReviewSteps(cfg),
    skillsLibrary: extra.skillsLibrary,
    shareLearnedSkills: extra.shareLearnedSkills,
    showToolCalls: showToolCallsEnabled(cfg),
    showReasoning: showReasoningEnabled(cfg),
    reasoningCollapse: reasoningCollapseMode(cfg),
    conversationStyle: conversationStyleMode(cfg),
    autoUpdate: autoUpdateEnabled(cfg),
    browser: builtInBrowserEnabled(cfg),
    sharedComputers: sharedComputersEnabled(cfg),
    claudeUserMcp: claudeUserMcpEnabled(cfg),
    claudeUserSkills: extra.claudeUserSkills,
    autoRecall: autoRecallEnabled(cfg),
    roomMemoryCapture: roomMemoryCaptureEnabled(cfg),
    parallelRoomJobs: extra.parallelRoomJobs,
    llmThreadTitles: extra.llmThreadTitles,
    savedSteps: extra.savedSteps,
    savedStepsHere: extra.savedStepsHere,
    usbPhoneTakeover: extra.usbPhoneTakeover,
  };
}
