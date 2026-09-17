// app/api/harness/chat/session-store.ts
import type {
  HarnessAgentResumeSessionState,
  HarnessAgentSession,
} from "@ai-sdk/harness/agent";
import { harnessAgent } from "./agent";

// In-memory only: resets on server restart and is not shared across
// serverless instances. Acceptable for this playground app; a real
// deployment needs durable storage (e.g. a database or KV store) instead.
const resumeStates = new Map<string, HarnessAgentResumeSessionState>();

export async function resumeOrCreateSession(chatId: string): Promise<HarnessAgentSession> {
  const resumeFrom = resumeStates.get(chatId);
  return harnessAgent.createSession(
    resumeFrom ? { sessionId: chatId, resumeFrom } : { sessionId: chatId },
  );
}

export async function detachAndPersist(
  chatId: string,
  session: HarnessAgentSession,
): Promise<void> {
  resumeStates.set(chatId, await session.detach());
}
