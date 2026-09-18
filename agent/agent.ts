import { defineAgent, defineDynamic } from "eve";

// Gateway model ids selectable from the UI. Kept in sync by hand with
// EVE_MODEL_IDS in lib/models.ts and the header read in
// agent/channels/eve.ts — files under agent/ can't import from outside it.
const SELECTABLE_MODEL_IDS = new Set([
  "anthropic/claude-opus-5",
  "anthropic/claude-sonnet-5",
  "anthropic/claude-haiku-4-5",
]);

// agent/channels/eve.ts's onMessage prepends the client's chosen model as a
// context message in this exact format, only for a session's first turn.
const MODEL_CONTEXT_PREFIX = "[[eve-model:";
const MODEL_CONTEXT_SUFFIX = "]]";

export default defineAgent({
  model: defineDynamic({
    fallback: "anthropic/claude-sonnet-5",
    // session.started (not turn.started): the model choice only applies to
    // a session's first turn, matching the UI locking the selector once a
    // chat has started — switching models means starting a new chat.
    events: {
      "session.started": (_event, ctx) => {
        for (const message of ctx.messages) {
          if (typeof message.content !== "string") continue;
          if (
            !message.content.startsWith(MODEL_CONTEXT_PREFIX) ||
            !message.content.endsWith(MODEL_CONTEXT_SUFFIX)
          ) {
            continue;
          }
          const modelId = message.content.slice(
            MODEL_CONTEXT_PREFIX.length,
            -MODEL_CONTEXT_SUFFIX.length,
          );
          if (SELECTABLE_MODEL_IDS.has(modelId)) {
            return modelId;
          }
        }
        return null;
      },
    },
  }),
});
