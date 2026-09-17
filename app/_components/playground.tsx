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
