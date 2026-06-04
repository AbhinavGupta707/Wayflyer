"use client";
/**
 * WS6 — VoiceWidget: the fit-concierge that speaks the already-decided offer.
 *
 * Mount this in the customer view (WS4) once a rescue has a decision:
 *
 *     import { VoiceWidget } from "@/components/voice-widget";
 *     <VoiceWidget rescueId={rescueId} apiBase="http://localhost:8000"
 *                  onAccepted={(r) => store.confirm(r)} />
 *
 * Three layers, most-reliable first:
 *   1. Text transcript of the decided offer + Yes / No buttons  (always works)
 *   2. ElevenLabs Conversational-AI browser widget               (if agent configured)
 *   3. "Call my phone" → real Twilio outbound call               (if telephony configured)
 *   +  a pre-rendered ElevenLabs audio clip as the stage fallback.
 *
 * A "yes" on any layer POSTs /api/voice/accept, which routes through the SAME
 * /api/rescue/{id}/respond confirmation path the chat flow uses.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";

// The ElevenLabs widget is a custom element loaded from a CDN script.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      "elevenlabs-convai": any;
    }
  }
}

type VoiceOffer = {
  rescue_id: string;
  customer_name: string;
  first_name: string;
  product_title: string;
  from_size: string;
  to_size?: string | null;
  price: number;
  currency: string;
  action: string;
  script: string;
  confirm_line: string;
  decline_line: string;
  dynamic_variables: Record<string, string>;
};

type StartResponse = {
  mode: string;
  agent_id?: string | null;
  signed_url?: string | null;
  dynamic_variables: Record<string, string>;
  offer: VoiceOffer;
  configured?: boolean;
};

const WIDGET_SRC = "https://unpkg.com/@elevenlabs/convai-widget-embed";

function useScript(src: string, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    if (document.querySelector(`script[src="${src}"]`)) return;
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.type = "text/javascript";
    document.body.appendChild(s);
  }, [src, enabled]);
}

export function VoiceWidget({
  rescueId,
  apiBase = "http://localhost:8000",
  onAccepted,
}: {
  rescueId: string;
  apiBase?: string;
  onAccepted?: (result: any) => void;
}) {
  const [offer, setOffer] = useState<VoiceOffer | null>(null);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "loading" | "ready" | "accepted" | "declined">("idle");
  const [confirmation, setConfirmation] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [callStatus, setCallStatus] = useState<string>("");
  const widgetMounted = useRef(false);

  useScript(WIDGET_SRC, !!agentId);

  const start = useCallback(async () => {
    setPhase("loading");
    try {
      const res = await fetch(`${apiBase}/api/rescue/${rescueId}/voice/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "widget" }),
      });
      const data: StartResponse = await res.json();
      setOffer(data.offer);
      setAgentId(data.agent_id ?? null);
      setSignedUrl(data.signed_url ?? null);
      setPhase("ready");
    } catch (e) {
      setCallStatus("Could not reach the voice service.");
      setPhase("idle");
    }
  }, [apiBase, rescueId]);

  const accept = useCallback(
    async (accepted: boolean) => {
      try {
        const res = await fetch(`${apiBase}/api/voice/accept`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rescue_id: rescueId, accepted }),
        });
        const data = await res.json();
        setConfirmation(
          data.confirmation || (accepted ? offer?.confirm_line : offer?.decline_line) || ""
        );
        setPhase(accepted ? "accepted" : "declined");
        if (accepted) onAccepted?.(data);
      } catch (e) {
        setConfirmation("Something went wrong confirming the exchange.");
      }
    },
    [apiBase, rescueId, offer, onAccepted]
  );

  const callPhone = useCallback(async () => {
    setCallStatus("Dialing…");
    try {
      const res = await fetch(`${apiBase}/api/rescue/${rescueId}/voice/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "phone", to_number: phone || undefined }),
      });
      const data = await res.json();
      setCallStatus(
        res.ok ? `Calling ${data.to} — pick up to hear the offer.` : data.error || "Call failed."
      );
    } catch (e) {
      setCallStatus("Telephony unavailable.");
    }
  }, [apiBase, rescueId, phone]);

  // Mount the ElevenLabs custom element imperatively so we can seed dynamic vars.
  const widgetSlot = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!agentId || !offer || widgetMounted.current || !widgetSlot.current) return;
    const el = document.createElement("elevenlabs-convai");
    el.setAttribute("agent-id", agentId);
    if (signedUrl) el.setAttribute("signed-url", signedUrl);
    el.setAttribute("dynamic-variables", JSON.stringify(offer.dynamic_variables));
    widgetSlot.current.appendChild(el);
    widgetMounted.current = true;
  }, [agentId, signedUrl, offer]);

  if (phase === "idle") {
    return (
      <div style={S.card}>
        <div style={S.kicker}>Fit concierge</div>
        <p style={S.lead}>Prefer to talk it through? Our concierge can walk you through the swap.</p>
        <button style={S.primary} onClick={start}>
          🎙️ Speak to the concierge
        </button>
      </div>
    );
  }

  if (phase === "loading" || !offer) {
    return <div style={S.card}>Connecting the concierge…</div>;
  }

  if (phase === "accepted" || phase === "declined") {
    return (
      <div style={S.card}>
        <div style={S.kicker}>{phase === "accepted" ? "✅ Confirmed" : "Refund"}</div>
        <p style={S.lead}>{confirmation}</p>
      </div>
    );
  }

  return (
    <div style={S.card}>
      <div style={S.kicker}>Fit concierge · {offer.customer_name}</div>
      <p style={S.script}>“{offer.script}”</p>

      {/* Pre-rendered ElevenLabs clip — the reliable stage fallback. */}
      <audio
        controls
        src={`${apiBase}/api/voice/audio/${rescueId}.mp3`}
        style={{ width: "100%", margin: "8px 0" }}
      />

      <div style={S.row}>
        <button style={S.primary} onClick={() => accept(true)}>
          Yes, ship the {offer.to_size ?? "exchange"}
        </button>
        <button style={S.ghost} onClick={() => accept(false)}>
          No, refund me
        </button>
      </div>

      {/* Live ElevenLabs conversational widget (if an agent is set) — speaks the
          offer and listens for the customer's yes/no. */}
      {agentId && <div ref={widgetSlot} style={{ marginTop: 12 }} />}
      {callStatus && <p style={S.status}>{callStatus}</p>}
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  card: {
    fontFamily: "ui-sans-serif, system-ui, sans-serif",
    maxWidth: 440,
    padding: 20,
    borderRadius: 16,
    background: "#0e1116",
    color: "#e8edf2",
    boxShadow: "0 8px 30px rgba(0,0,0,.35)",
    border: "1px solid #1d232c",
  },
  kicker: { fontSize: 12, letterSpacing: 0.6, textTransform: "uppercase", color: "#7aa2ff", marginBottom: 8 },
  lead: { fontSize: 15, lineHeight: 1.5, color: "#c7d0da", margin: "0 0 14px" },
  script: { fontSize: 16, lineHeight: 1.55, fontStyle: "italic", margin: "0 0 8px" },
  row: { display: "flex", gap: 8, alignItems: "center", marginTop: 6, flexWrap: "wrap" },
  primary: {
    flex: 1,
    minWidth: 160,
    padding: "11px 16px",
    borderRadius: 10,
    border: "none",
    background: "#3b6cff",
    color: "white",
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer",
  },
  ghost: {
    padding: "11px 16px",
    borderRadius: 10,
    border: "1px solid #2a3340",
    background: "transparent",
    color: "#c7d0da",
    fontSize: 14,
    cursor: "pointer",
  },
  input: {
    flex: 1,
    minWidth: 140,
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #2a3340",
    background: "#0a0d12",
    color: "#e8edf2",
    fontSize: 14,
  },
  summary: { cursor: "pointer", color: "#9fb2cc", fontSize: 14 },
  status: { fontSize: 13, color: "#9fb2cc", marginTop: 8 },
};

export default VoiceWidget;
