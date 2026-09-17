// app/api/harness/chat/agent.ts
import { HarnessAgent } from "@ai-sdk/harness/agent";
import { claudeCode } from "@ai-sdk/harness-claude-code";
import { createVercelSandbox } from "@ai-sdk/sandbox-vercel";

// Claude Code auto-detects credentials from the host process env: it prefers
// the Vercel AI Gateway (AI_GATEWAY_API_KEY or VERCEL_OIDC_TOKEN — the same
// credential the eve agent already relies on), falling back to a direct
// Anthropic key. See @ai-sdk/harness-claude-code/src/claude-code-auth.ts.
export const harnessAgent = new HarnessAgent({
  harness: claudeCode,
  id: "kaytv-eve-playground-claude-code",
  instructions:
    "You are a helpful coding assistant running in a sandbox for a demo playground app.",
  sandbox: createVercelSandbox({
    runtime: "node24",
    ports: [4000],
  }),
});
