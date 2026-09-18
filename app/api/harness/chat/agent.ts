// app/api/harness/chat/agent.ts
import { HarnessAgent } from "@ai-sdk/harness/agent";
import { createClaudeCode } from "@ai-sdk/harness-claude-code";
import { createVercelSandbox } from "@ai-sdk/sandbox-vercel";

// `auth: "direct"` forces a direct Anthropic API key instead of auto-detecting
// the Vercel AI Gateway (which the eve agent uses, but which the connected
// Vercel account's plan may not have model access through). Requires
// ANTHROPIC_API_KEY in .env.local. See
// @ai-sdk/harness-claude-code/src/claude-code-auth.ts.
export const harnessAgent = new HarnessAgent({
  harness: createClaudeCode({ auth: "direct" }),
  id: "kaytv-eve-playground-claude-code",
  instructions:
    "You are a helpful coding assistant running in a sandbox for a demo playground app.",
  sandbox: createVercelSandbox({
    runtime: "node24",
    ports: [4000],
  }),
});
