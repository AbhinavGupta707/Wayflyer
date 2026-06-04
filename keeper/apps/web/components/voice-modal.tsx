"use client";
/**
 * VoiceModal — central, hands-free fit concierge.
 *
 * Opens a centred popup, AUTO-STARTS the ElevenLabs conversation over WebRTC
 * (low latency), the agent immediately SPEAKS the decided offer ({{offer_script}})
 * and LISTENS. When the customer agrees/declines, the agent calls the
 * `confirm_return` CLIENT TOOL → we execute it via /api/voice/accept, let the agent
 * finish its confirmation line, then close and advance the screen automatically.
 *
 * Requires the agent to declare a client tool named `confirm_return` (param
 * `accepted`: boolean) in the ElevenLabs dashboard → Tools.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { API_BASE } from "@/lib/api";

export function VoiceModal({
  rescueId,
  onClose,
  onResolved,
}: {
  rescueId: string;
  onClose: () => void;
  onResolved: (accepted: boolean, confirmation: string, learningNote: string) => void;
}) {
  const [mode, setMode] = useState<"connecting" | "speaking" | "listening" | "error">("connecting");
  const [hint, setHint] = useState("Connecting your concierge…");
  const convRef = useRef<any>(null);
  const resolved = useRef(false);
  const finished = useRef(false);
  const resultRef = useRef({ accepted: false, confirmation: "", note: "" });
  const onResolvedRef = useRef(onResolved);
  onResolvedRef.current = onResolved;

  // Idempotent: called by the agent's end_call (onDisconnect) OR a fallback timer.
  const doFinish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    convRef.current?.endSession?.().catch(() => {});
    const r = resultRef.current;
    onResolvedRef.current(r.accepted, r.confirmation, r.note);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/rescue/${rescueId}/voice/start`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ channel: "widget" }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (!data.agent_id) {
          setMode("error");
          setHint("Voice agent isn't configured yet.");
          return;
        }
        const { Conversation } = await import("@elevenlabs/client");
        await navigator.mediaDevices.getUserMedia({ audio: true });

        const conv = await Conversation.startSession({
          agentId: data.agent_id,
          ...(data.signed_url ? { signedUrl: data.signed_url } : {}),
          connectionType: "webrtc",
          dynamicVariables: data.dynamic_variables || {},
          clientTools: {
            confirm_return: async ({ accepted }: { accepted: boolean | string }) => {
              const acc = accepted === true || accepted === "true";
              if (resolved.current) return "already handled";
              resolved.current = true;
              let confirmation = "";
              let note = "";
              try {
                const r = await fetch(`${API_BASE}/api/voice/accept`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ rescue_id: rescueId, accepted: acc }),
                });
                const j = await r.json();
                confirmation = j.confirmation || "";
                note = j.learning_note || "";
              } catch {
                /* ignore */
              }
              resultRef.current = { accepted: acc, confirmation, note };
              // The agent should end the call itself after confirming (onDisconnect
              // fires doFinish). This timer is only a fallback if it doesn't.
              setTimeout(doFinish, 6000);
              return acc ? "Exchange confirmed for the customer." : "Refund confirmed.";
            },
          },
          onConnect: () => { if (!cancelled) { setMode("listening"); setHint("Listening…"); } },
          onDisconnect: () => {
            if (cancelled) return;
            if (resolved.current) doFinish();   // agent ended the call after confirming
            else onClose();                      // ended/hung up without a resolution
          },
          onModeChange: ({ mode: m }: { mode: string }) => {
            if (cancelled || resolved.current) return;
            const speaking = m === "speaking";
            setMode(speaking ? "speaking" : "listening");
            setHint(speaking ? "Speaking…" : "Listening…");
          },
          onError: () => { if (!cancelled) { setMode("error"); setHint("Voice error — tap to close."); } },
        });
        convRef.current = conv;
      } catch {
        if (!cancelled) { setMode("error"); setHint("Couldn't start — allow microphone access."); }
      }
    })();
    return () => {
      cancelled = true;
      convRef.current?.endSession?.().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function close() {
    convRef.current?.endSession?.().catch(() => {});
    onClose();
  }
  const active = mode === "speaking" || mode === "listening";

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] grid place-items-center bg-char/55 p-4 backdrop-blur-sm"
      onClick={close}
    >
      <motion.div
        initial={{ scale: 0.94, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, opacity: 0 }}
        className="w-full max-w-sm rounded-3xl border border-cream-200 bg-white p-8 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative mx-auto grid h-28 w-28 place-items-center">
          {active && <span className="vorb-ring" />}
          {active && <span className="vorb-ring" style={{ animationDelay: "1.1s" }} />}
          <div className={`vorb h-20 w-20 ${mode === "speaking" ? "vorb--speaking" : ""}`} />
        </div>
        <h3 className="mt-5 font-serif text-2xl">Fit concierge</h3>
        <p className="mt-1 text-sm text-stone-500">{hint}</p>
        <button onClick={close} className="mt-6 text-xs text-stone-400 hover:text-stone-600">End call</button>
      </motion.div>
    </motion.div>
  );
}

export default VoiceModal;
