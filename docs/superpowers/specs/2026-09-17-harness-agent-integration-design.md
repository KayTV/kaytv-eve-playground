# AI SDK Harness Agent Integration

Date: 2026-09-17
Status: Approved for planning

## Problem

This app (`kaytv-eve-playground`) currently has a single chat surface backed by the
eve framework's own agent loop (`agent/agent.ts`, exposed over eve's built-in HTTP
channel and consumed client-side via `useEveAgent()` in
`app/_components/agent-chat.tsx`).

We want to add the Vercel AI SDK's `HarnessAgent` (from `@ai-sdk/harness`), which
runs an established coding-agent runtime (Claude Code, Codex, Pi, ...) inside a
sandbox, and make it possible to switch between the eve-backed chat and the new
harness-backed chat from the same page.

### Naming collision to be aware of

eve's own docs call its built-in agent loop "the harness"
(`node_modules/eve/docs/concepts/default-harness.md`). This is unrelated to the AI
SDK's `@ai-sdk/harness` package and its `HarnessAgent` class
(`node_modules/ai/docs/03-ai-sdk-harnesses/`). The two "harness" concepts do not
interoperate — eve is not one of the AI SDK's pluggable harness adapters (Claude
Code, Codex, Deep Agents, OpenCode, Pi). This spec treats them as two independent
backends wired together only at the application's routing/UI layer.

## Goals

- Add a working `HarnessAgent` backed by the `claudeCode` adapter
  (`@ai-sdk/harness-claude-code`) and Vercel Sandbox (`@ai-sdk/sandbox-vercel`,
  required because Claude Code is a bridge-backed adapter).
- Let a single page switch between the existing eve chat and the new Claude Code
  harness chat via a UI control, without altering eve's existing behavior.
- Keep scope to a playground-appropriate implementation — no production session
  durability requirements.

## Non-goals

- Building a shared abstraction/client that unifies eve's session protocol and the
  AI SDK's UI-message-stream protocol. eve's client (`useEveAgent`) already
  provides session management, streaming, and human-in-the-loop support that would
  otherwise need to be reimplemented; the two chat stacks stay independent and are
  switched at the UI level instead.
- Multi-instance-safe or durable session storage for the harness chat (in-memory
  is acceptable for this app).
- Adding additional harness adapters (Codex, Pi, etc.) beyond Claude Code. The
  design should not preclude adding them later, but only Claude Code is built now.

## Architecture

Two independent chat stacks render on the same page, chosen by a selector:

```
app/page.tsx
├── BackendSwitcher (client state: "eve" | "claude-code")
├── <AgentChat />        (existing, untouched) — eve path
└── <HarnessChat />      (new) — Claude Code harness path
```

### Eve path (unchanged)

`useEveAgent()` → eve's built-in `/eve/v1/session` HTTP channel → eve's own
agent loop in `agent/agent.ts`. No changes to any eve files.

### Claude Code harness path (new)

```
app/_components/harness-chat.tsx   (new client component, useChat)
app/api/harness/chat/route.ts      (new, POST handler)
app/api/harness/chat/agent.ts      (new, constructs HarnessAgent)
app/api/harness/chat/session-store.ts (new, in-memory resume-state map)
```

- `agent.ts` constructs a module-scope `HarnessAgent` with `harness: claudeCode`
  and `sandbox: createVercelSandbox({ runtime: "node24", ports: [4000] })`,
  following the pattern in `node_modules/ai/docs/03-ai-sdk-harnesses/02-harness-agent.mdx`
  and `.../07-ui.mdx`.
- `session-store.ts` is an in-memory `Record<string, HarnessAgentResumeSessionState>`
  keyed by chat id, per the AI SDK's own reference implementation. This resets on
  server restart and is not shared across serverless instances — acceptable for
  this playground app, called out with a code comment rather than solved.
- `route.ts` resumes-or-creates a `HarnessAgentSession` for the chat id, runs
  `agent.stream({ session, messages })`, converts the result to a UI message
  stream, and persists resume state via `session.detach()` in an `onEnd` callback.
- `harness-chat.tsx` uses `useChat({ id, transport: new DefaultChatTransport({ api: "/api/harness/chat" }) })`
  from `@ai-sdk/react`, rendering `text` and `tool-*`/`dynamic-tool` message parts.

## Data flow

1. User picks a backend in the selector on `app/page.tsx`.
2. **Eve selected:** identical to today's behavior — no new code runs.
3. **Claude Code selected:** `<HarnessChat>` sends a message via `useChat` →
   `POST /api/harness/chat` → route loads/creates session from
   `session-store.ts` → `agent.stream(...)` runs a real turn inside the Vercel
   Sandbox running Claude Code → streamed UI message parts render in the chat →
   on stream end, resume state is persisted back to the store.

## New dependencies

- `@ai-sdk/harness`
- `@ai-sdk/harness-claude-code`
- `@ai-sdk/sandbox-vercel`

## Configuration / credentials

Vercel Sandbox and the Claude Code adapter both require credentials that are not
yet present in this repo (only `VERCEL_OIDC_TOKEN` exists today, for eve's own
auth). Per this repo's `AGENTS.md` convention, the exact required environment
variables will be determined by reading each installed package's own docs/README
under `node_modules/@ai-sdk/sandbox-vercel` and `node_modules/@ai-sdk/harness-claude-code`
once installed, rather than guessed here. The implementation step will:

- List the required env var names in `.env.local` (as empty/placeholder entries)
  for the user to fill in themselves.
- Not request, receive, or enter any actual secret values on the user's behalf.

## Error handling

- If required env vars are missing, the harness route should fail with a clear
  error surfaced to the chat UI (via the existing `useChat` error state) rather
  than a silent failure.
- Sandbox/bridge failures (e.g. Claude Code process crash) propagate as stream
  errors; no custom retry logic is added (YAGNI for a playground app).

## Testing

Manual verification only, via `npm run dev` and the browser pane:

- Eve path still works unchanged after the switcher is added.
- Claude Code path completes a full turn end-to-end, including at least one tool
  call, confirming the sandbox bridge works.
- Switching backends mid-session does not crash the page (each backend keeps its
  own independent message history/component state).

## Open questions for implementation time

- Exact required env var names for `@ai-sdk/sandbox-vercel` and
  `@ai-sdk/harness-claude-code` (resolved by reading installed package docs).
- Whether `createVercelSandbox`'s `ports` option needs a specific port for Claude
  Code's bridge (resolved the same way).
