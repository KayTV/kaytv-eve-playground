// app/api/harness/chat/agent.ts
import { HarnessAgent } from "@ai-sdk/harness/agent";
import { createClaudeCode } from "@ai-sdk/harness-claude-code";
import { createVercelSandbox } from "@ai-sdk/sandbox-vercel";
import { HARNESS_MODEL_IDS, type ModelOptionId } from "@/lib/models";

// `auth: "direct"` forces a direct Anthropic API key instead of auto-detecting
// the Vercel AI Gateway (which the eve agent uses, but which the connected
// Vercel account's plan may not have model access through). Requires
// ANTHROPIC_API_KEY in .env.local. See
// @ai-sdk/harness-claude-code/src/claude-code-auth.ts.
const harness = createClaudeCode({ auth: "direct" });

// `sandbox` is a stable provider factory, not a live sandbox — safe to share
// across every model's HarnessAgent instance below.
const sandbox = createVercelSandbox({
  runtime: "node24",
  ports: [4000],
});

// One HarnessAgent per selectable model: `model` is fixed at construction, and
// a session is tied to the specific instance that created it, so switching
// models means starting a new session rather than swapping model on one
// shared agent. See session-store.ts.
export const harnessAgents: Record<ModelOptionId, HarnessAgent> = Object.fromEntries(
  Object.entries(HARNESS_MODEL_IDS).map(([modelOptionId, model]) => [
    modelOptionId,
    new HarnessAgent({
      harness,
      id: `kaytv-eve-playground-claude-code-${modelOptionId}`,
      instructions:
        "You are a helpful coding assistant running in a sandbox for a demo playground app.",
      model,
      sandbox,
    }),
  ]),
) as Record<ModelOptionId, HarnessAgent>;
