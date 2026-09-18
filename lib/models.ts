// Shared model catalog for the backend switcher's model selector. Both
// backends offer the same three tiers under one label set, mapped to each
// backend's own model-id format.
export const MODEL_OPTIONS = [
  { id: "opus-5", label: "Opus 5" },
  { id: "sonnet-5", label: "Sonnet 5" },
  { id: "haiku-4-5", label: "Haiku 4.5" },
] as const;

export type ModelOptionId = (typeof MODEL_OPTIONS)[number]["id"];

export const DEFAULT_MODEL_OPTION_ID: ModelOptionId = "sonnet-5";

// Native Anthropic API model ids, used directly by the Claude Code harness
// (configured with auth: "direct", so it calls Anthropic directly rather
// than through the Vercel AI Gateway).
export const HARNESS_MODEL_IDS: Record<ModelOptionId, string> = {
  "opus-5": "claude-opus-5",
  "sonnet-5": "claude-sonnet-5",
  "haiku-4-5": "claude-haiku-4-5",
};

// Vercel AI Gateway model ids ("provider/model"), used by the eve agent.
// Kept in sync by hand with the equivalent list in agent/agent.ts and
// agent/channels/eve.ts, which can't import from outside agent/.
export const EVE_MODEL_IDS: Record<ModelOptionId, string> = {
  "opus-5": "anthropic/claude-opus-5",
  "sonnet-5": "anthropic/claude-sonnet-5",
  "haiku-4-5": "anthropic/claude-haiku-4-5",
};
