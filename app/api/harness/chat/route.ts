// app/api/harness/chat/route.ts
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import { harnessAgent } from "./agent";
import { detachAndPersist, resumeOrCreateSession } from "./session-store";

export async function POST(request: Request) {
  const body: { id?: string; messages: UIMessage[] } = await request.json();

  if (!body.id) {
    throw new Error("Missing chat id");
  }

  const chatId = body.id;
  const messages = await convertToModelMessages(body.messages);
  const session = await resumeOrCreateSession(chatId);
  const result = await harnessAgent.stream({ session, messages });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      onEnd: async () => {
        await detachAndPersist(chatId, session);
      },
    }),
  });
}
