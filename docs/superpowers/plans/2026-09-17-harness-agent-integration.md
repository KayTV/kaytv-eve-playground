# Harness Agent Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Claude Code `HarnessAgent` (from the Vercel AI SDK's `@ai-sdk/harness`) to this app, and let a single page switch between it and the existing eve-backed chat via a UI selector.

**Architecture:** Two independent chat stacks render on the same page behind a backend selector: the existing `useEveAgent()`-backed `<AgentChat>` (unchanged), and a new `useChat()`-backed `<HarnessChat>` talking to a new `/api/harness/chat` route that runs a `HarnessAgent` configured with the `claudeCode` adapter and a Vercel Sandbox.

**Tech Stack:** Next.js App Router, AI SDK v7 (`ai`, `@ai-sdk/react`), `@ai-sdk/harness`, `@ai-sdk/harness-claude-code`, `@ai-sdk/sandbox-vercel`, existing `components/ai-elements/*` primitives.

**Spec:** [docs/superpowers/specs/2026-09-17-harness-agent-integration-design.md](../specs/2026-09-17-harness-agent-integration-design.md)

## Global Constraints

- No changes to any file under `agent/` — the eve path stays exactly as it is today.
- No new environment variables required. The Claude Code adapter auto-detects credentials from the host process env in this order: AI Gateway (`AI_GATEWAY_API_KEY` or `VERCEL_OIDC_TOKEN`), then direct Anthropic (`ANTHROPIC_API_KEY` / `ANTHROPIC_AUTH_TOKEN` / `CLAUDE_CODE_OAUTH_TOKEN`) — see `node_modules/@ai-sdk/harness-claude-code/src/claude-code-auth.ts`. This app already relies on `VERCEL_OIDC_TOKEN` for eve's own model calls, so the same credential covers the harness path once `vercel link` + `vercel env pull` have been run.
- In-memory session storage only for the harness chat (resets on restart, not multi-instance safe) — a known, accepted limitation for this playground app, not something to solve.
- Only the Claude Code adapter is wired up now; do not add Codex/Pi/etc. adapters.
- Reuse the existing `components/ai-elements/*` primitives (`Message`, `MessageContent`, `MessageResponse`, `Reasoning*`, `Tool*`, `Conversation*`, `PromptInput*`) and `components/ui/select.tsx` rather than introducing new UI primitives.
- Dependencies `@ai-sdk/harness@^1.0.115`, `@ai-sdk/harness-claude-code@^1.0.119`, `@ai-sdk/sandbox-vercel@^1.0.115`, and `@ai-sdk/react@^4.0.108` are already installed (added and verified against their installed READMEs/type declarations during planning) — no install step needed.

---

### Task 1: HarnessAgent instance and session store

**Files:**
- Create: `app/api/harness/chat/agent.ts`
- Create: `app/api/harness/chat/session-store.ts`

**Interfaces:**
- Produces: `harnessAgent: HarnessAgent` (exported from `agent.ts`), used by Task 2's route and by `session-store.ts`.
- Produces: `resumeOrCreateSession(chatId: string): Promise<HarnessAgentSession>` and `detachAndPersist(chatId: string, session: HarnessAgentSession): Promise<void>` (exported from `session-store.ts`), used by Task 2's route.

- [ ] **Step 1: Write `agent.ts`**

```ts
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
```

- [ ] **Step 2: Write `session-store.ts`**

```ts
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
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors referencing `app/api/harness/chat/agent.ts` or `session-store.ts`.

- [ ] **Step 4: Commit**

```bash
git add app/api/harness/chat/agent.ts app/api/harness/chat/session-store.ts
git commit -m "feat: add Claude Code HarnessAgent instance and session store"
```

---

### Task 2: Harness chat API route

**Files:**
- Create: `app/api/harness/chat/route.ts`

**Interfaces:**
- Consumes: `harnessAgent` from `./agent` (Task 1); `resumeOrCreateSession`, `detachAndPersist` from `./session-store` (Task 1).
- Produces: `POST /api/harness/chat` endpoint accepting `{ id: string; messages: UIMessage[] }` and returning a UI-message-stream `Response`, consumed by Task 3's `<HarnessChat>` via `DefaultChatTransport({ api: "/api/harness/chat" })`.

- [ ] **Step 1: Write the route**

```ts
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
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors referencing `app/api/harness/chat/route.ts`.

- [ ] **Step 3: Manual smoke test**

Run: `npm run dev`, then in another terminal:

```bash
curl -N -X POST http://localhost:3000/api/harness/chat \
  -H 'content-type: application/json' \
  -d '{"id":"smoke-test","messages":[{"id":"1","role":"user","parts":[{"type":"text","text":"Say hello in one word."}]}]}'
```

Expected: a streamed UI-message-stream response (SSE-style `data: ...` lines) rather than an immediate error. If this fails with an authentication error, that means `VERCEL_OIDC_TOKEN` isn't populated yet — run `vercel link` and `vercel env pull` in the project root, then retry. A route-level bug (missing import, bad JSON handling) is the thing this step is checking for; a credential error is expected and acceptable if local Vercel auth isn't set up yet.

- [ ] **Step 4: Commit**

```bash
git add app/api/harness/chat/route.ts
git commit -m "feat: add Claude Code harness chat API route"
```

---

### Task 3: Harness chat UI components

**Files:**
- Create: `app/_components/harness-message.tsx`
- Create: `app/_components/harness-chat.tsx`

**Interfaces:**
- Consumes: `useChat` and `DefaultChatTransport` from `@ai-sdk/react` / `ai`; `POST /api/harness/chat` (Task 2).
- Produces: `HarnessChat` component (exported from `harness-chat.tsx`), used by Task 4's `<Playground>`.

- [ ] **Step 1: Write `harness-message.tsx`**

```tsx
// app/_components/harness-message.tsx
"use client";

import type { ToolUIPart, UIMessage } from "ai";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "@/components/ai-elements/reasoning";
import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from "@/components/ai-elements/tool";

export function HarnessMessage({
  isStreaming,
  message,
}: {
  readonly isStreaming: boolean;
  readonly message: UIMessage;
}) {
  const lastTextIndex = message.parts.reduce(
    (last, part, index) => (part.type === "text" ? index : last),
    -1,
  );

  return (
    <Message from={message.role}>
      <MessageContent>
        {message.parts.map((part, index) => (
          <HarnessMessagePart
            key={`${part.type}:${index}`}
            part={part}
            showCaret={isStreaming && message.role === "assistant" && index === lastTextIndex}
          />
        ))}
      </MessageContent>
    </Message>
  );
}

function HarnessMessagePart({
  part,
  showCaret,
}: {
  readonly part: UIMessage["parts"][number];
  readonly showCaret: boolean;
}) {
  if (part.type === "text") {
    return (
      <MessageResponse caret="block" isAnimating={showCaret}>
        {part.text}
      </MessageResponse>
    );
  }

  if (part.type === "reasoning") {
    return (
      <Reasoning defaultOpen isStreaming={part.state === "streaming"}>
        <ReasoningTrigger />
        <ReasoningContent>{part.text}</ReasoningContent>
      </Reasoning>
    );
  }

  if (part.type === "dynamic-tool") {
    return (
      <Tool>
        <ToolHeader state={part.state} toolName={part.toolName} type="dynamic-tool" />
        <ToolContent>
          <ToolInput input={part.input} />
          <ToolOutput errorText={part.errorText} output={part.output} />
        </ToolContent>
      </Tool>
    );
  }

  if (part.type.startsWith("tool-")) {
    // Harness built-in and host tool parts share the standard AI SDK
    // ToolUIPart shape; narrow with a cast since `part.type` is only known
    // to be `tool-${string}` at this point, not a specific tool name.
    const toolPart = part as ToolUIPart;
    return (
      <Tool>
        <ToolHeader state={toolPart.state} type={toolPart.type} />
        <ToolContent>
          <ToolInput input={toolPart.input} />
          <ToolOutput errorText={toolPart.errorText} output={toolPart.output} />
        </ToolContent>
      </Tool>
    );
  }

  return null;
}
```

- [ ] **Step 2: Write `harness-chat.tsx`**

```tsx
// app/_components/harness-chat.tsx
"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState } from "react";
import { AlertCircleIcon } from "lucide-react";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  PromptInput,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { cn } from "@/lib/utils";
import { HarnessMessage } from "./harness-message";

const AGENT_NAME = "Claude Code (harness)";

export function HarnessChat() {
  const [chatId] = useState(() => crypto.randomUUID());
  const { messages, sendMessage, status, stop, error } = useChat({
    id: chatId,
    transport: new DefaultChatTransport({ api: "/api/harness/chat" }),
  });
  const isBusy = status === "submitted" || status === "streaming";
  const isEmpty = messages.length === 0;

  const handleSubmit = async (message: PromptInputMessage) => {
    const text = message.text.trim();
    if (text.length === 0 || isBusy) return;
    await sendMessage({ text });
  };

  const composer = (
    <PromptInput onSubmit={handleSubmit}>
      <PromptInputTextarea placeholder="Send a message…" />
      <PromptInputSubmit onStop={stop} status={status} />
    </PromptInput>
  );

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      {isEmpty ? null : (
        <header className="flex h-14 shrink-0 items-center justify-center gap-3 pl-4 pr-2">
          <span className="truncate text-muted-foreground text-sm">{AGENT_NAME}</span>
        </header>
      )}

      {error ? (
        <div className="mx-auto w-full max-w-3xl shrink-0 px-4 pt-2 sm:px-6">
          <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm">
            <AlertCircleIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
            <div>
              <p className="font-medium">Request failed</p>
              <p className="mt-0.5 text-muted-foreground">{error.message}</p>
            </div>
          </div>
        </div>
      ) : null}

      {isEmpty ? null : (
        <Conversation className="min-h-0 flex-1">
          <ConversationContent className="mx-auto w-full max-w-3xl gap-6 px-4 py-6 sm:px-6">
            {messages.map((message, index) => (
              <HarnessMessage
                isStreaming={status === "streaming" && index === messages.length - 1}
                key={message.id}
                message={message}
              />
            ))}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
      )}

      <div
        className={cn(
          "mx-auto w-full px-4 sm:px-6",
          isEmpty
            ? "flex max-w-xl flex-1 flex-col items-center justify-center gap-8 pb-[10vh]"
            : "max-w-3xl shrink-0 pb-6",
        )}
      >
        {isEmpty ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <h1 className="font-medium text-5xl tracking-tighter">{AGENT_NAME}</h1>
          </div>
        ) : null}
        <div className="w-full">{composer}</div>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors referencing `app/_components/harness-message.tsx` or `harness-chat.tsx`.

- [ ] **Step 4: Commit**

```bash
git add app/_components/harness-message.tsx app/_components/harness-chat.tsx
git commit -m "feat: add Claude Code harness chat UI components"
```

---

### Task 4: Backend switcher and end-to-end verification

**Files:**
- Create: `app/_components/playground.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `AgentChat` from `./agent-chat` (existing), `HarnessChat` from `./harness-chat` (Task 3), `Select`/`SelectTrigger`/`SelectValue`/`SelectContent`/`SelectItem` from `@/components/ui/select`.
- Produces: `Playground` component (default export), rendered by `app/page.tsx`.

- [ ] **Step 1: Write `playground.tsx`**

```tsx
// app/_components/playground.tsx
"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AgentChat } from "./agent-chat";
import { HarnessChat } from "./harness-chat";

type Backend = "eve" | "claude-code";

export function Playground() {
  const [backend, setBackend] = useState<Backend>("eve");

  return (
    <div className="relative h-dvh">
      <div className="absolute top-4 right-4 z-10">
        <Select onValueChange={(value) => setBackend(value as Backend)} value={backend}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="eve">eve</SelectItem>
            <SelectItem value="claude-code">Claude Code</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {backend === "eve" ? <AgentChat /> : <HarnessChat />}
    </div>
  );
}
```

- [ ] **Step 2: Modify `app/page.tsx`**

```tsx
// app/page.tsx
import { Playground } from "@/app/_components/playground";

export default function Page() {
  return <Playground />;
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Manual browser verification**

Run: `npm run dev`, open the app in the browser.

- Confirm the selector defaults to "eve" and the page behaves exactly as it did before this change (send a message, get a response).
- Switch the selector to "Claude Code". Confirm the empty-state screen renders with the "Claude Code (harness)" heading.
- Send a message that requires a tool call (e.g. "List the files in the current directory"). Confirm the message streams in, a tool part renders (via the `Tool`/`ToolHeader`/`ToolContent` components), and the turn completes without a thrown error in the browser console.
- Switch back to "eve" and confirm its conversation state is preserved (component didn't unmount-reset unexpectedly is fine either way — both are acceptable per the design; just confirm no crash).
- If the Claude Code turn fails with an authentication error, run `vercel link` and `vercel env pull` in the project root (per Task 2's note) and retry — this is expected until local Vercel credentials are set up, not a bug in this code.

- [ ] **Step 5: Commit**

```bash
git add app/_components/playground.tsx app/page.tsx
git commit -m "feat: add backend switcher between eve and Claude Code harness chat"
```
