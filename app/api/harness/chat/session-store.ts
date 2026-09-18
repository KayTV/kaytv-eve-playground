// app/api/harness/chat/session-store.ts
import type {
  HarnessAgentResumeSessionState,
  HarnessAgentSession,
} from "@ai-sdk/harness/agent";
import type { ModelOptionId } from "@/lib/models";
import { harnessAgents } from "./agent";

type StoredChat = {
  readonly modelOptionId: ModelOptionId;
  readonly resumeState?: HarnessAgentResumeSessionState;
};

// In-memory only: resets on server restart and is not shared across
// serverless instances. Acceptable for this playground app; a real
// deployment needs durable storage (e.g. a database or KV store) instead.
const chats = new Map<string, StoredChat>();

export function harnessAgentFor(modelOptionId: ModelOptionId) {
  return harnessAgents[modelOptionId];
}

// The model choice only applies when a chat id is first seen — an existing
// chat keeps the model it started with, since a session is tied to the
// specific HarnessAgent instance that created it.
export async function resumeOrCreateSession(
  chatId: string,
  requestedModelOptionId: ModelOptionId,
): Promise<{ readonly modelOptionId: ModelOptionId; readonly session: HarnessAgentSession }> {
  const existing = chats.get(chatId);
  const modelOptionId = existing?.modelOptionId ?? requestedModelOptionId;
  const agent = harnessAgents[modelOptionId];

  const session = existing?.resumeState
    ? await agent.createSession({ resumeFrom: existing.resumeState, sessionId: chatId })
    : await agent.createSession({ sessionId: chatId });

  if (!existing) {
    chats.set(chatId, { modelOptionId });
  }

  return { modelOptionId, session };
}

export async function detachAndPersist(
  chatId: string,
  modelOptionId: ModelOptionId,
  session: HarnessAgentSession,
): Promise<void> {
  chats.set(chatId, { modelOptionId, resumeState: await session.detach() });
}
