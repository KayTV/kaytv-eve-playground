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
