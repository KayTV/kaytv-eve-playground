// app/api/harness/chat/route.ts
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import { DEFAULT_MODEL_OPTION_ID, type ModelOptionId } from "@/lib/models";
import { detachAndPersist, harnessAgentFor, resumeOrCreateSession } from "./session-store";

export async function POST(request: Request) {
  const body: { id?: string; messages: UIMessage[]; model?: ModelOptionId } =
    await request.json();

  if (!body.id) {
    throw new Error("Missing chat id");
  }

  const chatId = body.id;
  const messages = await convertToModelMessages(body.messages);
  const { modelOptionId, session } = await resumeOrCreateSession(
    chatId,
    body.model ?? DEFAULT_MODEL_OPTION_ID,
  );
  const harnessAgent = harnessAgentFor(modelOptionId);

  try {
    const result = await harnessAgent.stream({ session, messages });

    return createUIMessageStreamResponse({
      stream: toUIMessageStream({
        stream: result.stream,
        onEnd: async () => {
          await detachAndPersist(chatId, modelOptionId, session);
        },
      }),
    });
  } catch (error) {
    await session.destroy().catch(() => {});
    throw error;
  }
}
