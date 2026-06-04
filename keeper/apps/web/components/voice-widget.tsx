"use client";
/**
 * VoiceWidget — a single voice icon. Click it and the ElevenLabs conversational
 * concierge starts: it SPEAKS the decided offer (first message {{offer_script}})
 * and LISTENS for the customer's yes/no. If no agent is configured, it falls back
 * to simply playing the spoken offer clip.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements { "elevenlabs-convai": any; }
  }
}

const WIDGET_SRC = "https://unpkg.com/@elevenlabs/convai-widget-embed";

function useScript(src: string, enabled: boolean) {
  useEffect(() => {
    if (!enabled || document.querySelector(`script[src="${src}"]`)) return;
    const s = document.createElement("script");
    s.src = src; s.async = true; s.type = "text/javascript";
    document.body.appendChild(s);
  }, [src, enabled]);
}

export function VoiceWidget({
  rescueId,
  apiBase = "http://localhost:8000",
}: {
  rescueId: string;
  apiBase?: string;
  onAccepted?: (result: any) => void;
}) {
  const [phase, setPhase] = useState<"idle" | "loading" | "live" | "playing">("idle");
  const [agentId, setAgentId] = useState<string | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [dynVars, setDynVars] = useState<Record<string, string>>({});
  const [status, setStatus] = useState("");
  const slot = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);

  useScript(WIDGET_SRC, !!agentId);

  const start = useCallback(async () => {
    setPhase("loading");
    setStatus("Connecting your concierge…");
    try {
      const res = await fetch(`${apiBase}/api/rescue/${rescueId}/voice/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "widget" }),
      });
      const data = await res.json();
      if (data.agent_id) {
        setAgentId(data.agent_id);
        setSignedUrl(data.signed_url ?? null);
        setDynVars(data.dynamic_variables || {});
        setPhase("live");
        setStatus("Tap the orb and say hello — the concierge has your offer.");
      } else {
        // No conversational agent configured → just play the spoken offer.
        setPhase("playing");
        setStatus("");
        const a = new Audio(`${apiBase}/api/voice/audio/${rescueId}.mp3`);
        a.play().catch(() => setStatus("Voice isn't configured yet."));
      }
    } catch {
      setStatus("Couldn't reach the voice service.");
      setPhase("idle");
    }
  }, [apiBase, rescueId]);

  // Mount the conversational widget once we have an agent.
  useEffect(() => {
    if (!agentId || mounted.current || !slot.current) return;
    const el = document.createElement("elevenlabs-convai");
    el.setAttribute("agent-id", agentId);
    if (signedUrl) el.setAttribute("signed-url", signedUrl);
    el.setAttribute("dynamic-variables", JSON.stringify(dynVars));
    slot.current.appendChild(el);
    mounted.current = true;
  }, [agentId, signedUrl, dynVars]);

  return (
    <div className="flex flex-col items-center gap-2 py-1">
      {phase === "idle" ? (
        <button
          onClick={start}
          aria-label="Speak to the concierge"
          className="group grid h-14 w-14 place-items-center rounded-full border border-cream-300 bg-white shadow-sm transition hover:scale-105 hover:border-mint-400"
        >
          <svg className="h-6 w-6 text-stone-600 transition group-hover:text-mint-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
            <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
            <path d="M19 11a7 7 0 0 1-14 0M12 18v4M8 22h8" strokeLinecap="round" />
          </svg>
        </button>
      ) : (
        <div ref={slot} />
      )}
      <span className="text-xs text-stone-400">
        {phase === "idle" ? "Prefer to talk it through?" : status}
      </span>
    </div>
  );
}

export default VoiceWidget;
