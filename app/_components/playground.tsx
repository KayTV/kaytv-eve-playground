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
import { DEFAULT_MODEL_OPTION_ID, MODEL_OPTIONS, type ModelOptionId } from "@/lib/models";
import { AgentChat } from "./agent-chat";
import { HarnessChat } from "./harness-chat";

type Backend = "eve" | "claude-code";

export function Playground() {
  const [backend, setBackend] = useState<Backend>("eve");
  const [model, setModel] = useState<ModelOptionId>(DEFAULT_MODEL_OPTION_ID);
  const [isChatEmpty, setIsChatEmpty] = useState(true);

  return (
    <div className="relative h-dvh">
      <div className="absolute top-4 right-4 z-10 flex gap-2">
        <Select
          disabled={!isChatEmpty}
          onValueChange={(value) => setModel(value as ModelOptionId)}
          value={model}
        >
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MODEL_OPTIONS.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
      {backend === "eve" ? (
        <AgentChat model={model} onEmptyChange={setIsChatEmpty} />
      ) : (
        <HarnessChat model={model} onEmptyChange={setIsChatEmpty} />
      )}
    </div>
  );
}
