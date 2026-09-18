import type { NextConfig } from "next";
import { withEve } from "eve/next";

const nextConfig: NextConfig = {
  // These packages locate their runtime assets (bridge bootstrap files for
  // the sandboxed Claude Code harness) via `new URL(..., import.meta.url)`
  // relative to their own compiled module. Next.js bundling Route Handler
  // imports by default breaks that resolution — it inlines the wrong file's
  // content instead of reading the real sibling asset on disk — which
  // surfaced as a "not valid JSON" bootstrap failure inside the sandbox.
  // Keeping them external makes Node's own module resolution handle them.
  serverExternalPackages: [
    "@ai-sdk/harness",
    "@ai-sdk/harness-claude-code",
    "@ai-sdk/sandbox-vercel",
  ],
};

export default withEve(nextConfig);
