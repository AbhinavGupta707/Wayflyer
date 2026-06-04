"use client";

// Bottom strip: a terminal echoing the streamed `thinking` token-by-token.
// Each agent gets a coloured prompt; the live line keeps a blinking caret and
// the view auto-scrolls to the tail as text flows in.

import { useEffect, useRef } from "react";
import { metaFor } from "./agent-meta";
import type { ConsoleLine } from "./agent-replay";

export function AgentConsole({ lines }: { lines: ConsoleLine[] }) {
  const tailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    tailRef.current?.scrollIntoView({ block: "end" });
  }, [lines]);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-white/5 bg-black/50 backdrop-blur-md">
      <div className="flex items-center gap-2 border-b border-white/5 px-3 py-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f56]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#27c93f]" />
        <span className="ml-2 font-mono text-[10px] uppercase tracking-widest text-white/30">
          keeper · reasoning stream
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 font-mono text-[11.5px] leading-relaxed">
        {lines.length === 0 && (
          <span className="text-white/25">awaiting first token…</span>
        )}
        {lines.map((line, idx) => {
          const meta = metaFor(line.agent);
          const isLast = idx === lines.length - 1;
          return (
            <div key={line.id} className="whitespace-pre-wrap break-words">
              <span style={{ color: meta.accent }}>{meta.id}</span>
              <span className="text-white/25"> ❯ </span>
              <span className="text-white/70">{line.text}</span>
              {isLast && !line.done && (
                <span
                  className="ml-0.5 inline-block h-[1em] w-[7px] translate-y-[2px] animate-blink"
                  style={{ background: meta.accent }}
                />
              )}
            </div>
          );
        })}
        <div ref={tailRef} />
      </div>
    </div>
  );
}
