"use client";

// Route: /agent — Keeper's reasoning console (WS5).
// Mounts the AgentView and wires the two shell hand-offs from WS7's contract:
//   • rescueId comes from the scene store (set by WS4 via openAgentView)
//   • onReturnToCustomer zooms back out (useScene.returnToCustomer) and, since
//     the demo is route-based, also navigates back to the Customer scene.

import { useRouter } from "next/navigation";
import { useScene } from "@/lib/scene";
import { AgentView } from "@/components/agent-view";

export default function AgentPage() {
  const router = useRouter();
  const returnToCustomer = useScene((s) => s.returnToCustomer);
  const activeRescueId = useScene((s) => s.activeRescueId);

  return (
    <AgentView
      rescueId={activeRescueId ?? undefined}
      onReturnToCustomer={() => {
        returnToCustomer();
        router.push("/outcome");
      }}
    />
  );
}
