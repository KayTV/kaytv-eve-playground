import { defaultEveAuth, eveChannel } from "eve/channels/eve";
import { localDev, placeholderAuth, vercelOidc } from "eve/channels/auth";

// Gateway model ids selectable from the UI. Kept in sync by hand with
// EVE_MODEL_IDS in lib/models.ts and the dynamic model resolver in
// agent/agent.ts — files under agent/ can't import from outside it.
const SELECTABLE_MODEL_IDS = new Set([
  "anthropic/claude-opus-5",
  "anthropic/claude-sonnet-5",
  "anthropic/claude-haiku-4-5",
]);

export default eveChannel({
  auth: [
    // Lets the eve TUI and your Vercel deployments reach the deployed agent.
    vercelOidc(),
    // Open on localhost for `eve dev` and the REPL; ignored in production.
    localDev(),
    // This placeholder will not allow browser requests in production.
    // Replace it with your app's auth provider, like Auth.js or Clerk,
    // or use none() for a public demo.
    placeholderAuth(),
  ],
  // Reads the model the client picked (app/_components/agent-chat.tsx sends
  // it as a header) and prepends it as a context message, so agent.ts's
  // session.started model resolver can read it back. Only meaningful on a
  // session's first turn — see agent.ts for why. The prepended message is a
  // real, durable user-role message, so app/_components/agent-message.tsx
  // filters it out of rendering by its exact marker format.
  onMessage(ctx, message) {
    const requestedModel = ctx.eve.request.headers.get("x-eve-model");
    const context =
      requestedModel && SELECTABLE_MODEL_IDS.has(requestedModel)
        ? [`[[eve-model:${requestedModel}]]`]
        : undefined;
    return { auth: defaultEveAuth(ctx), context };
  },
});
