// Live "this session" rescue ledger — the counter that ticks on the ops board
// every time an operator accepts a rescue (POST /api/rescue/{id}/respond).
//
// WS4/WS5 (or whoever owns the accept button) call recordRespond(resp) after a
// successful accept; the ops dashboard subscribes and animates the delta.

import { create } from "zustand";
import type { RespondResponse } from "./types";

interface SessionState {
  rescuesSaved: number;
  recoveredGbp: number;
  marginGbp: number;
  /** seq number bumped on each tick so the dashboard can trigger a pop animation. */
  lastTick: number;

  /** Call after a successful accept. Sums the realised margin from the actions. */
  recordRespond: (resp: RespondResponse) => void;
  /** Manual add (e.g. when economics are known but no actions array). */
  addRescue: (recoveredGbp: number, marginGbp: number) => void;
  reset: () => void;
}

function sumMargin(resp: RespondResponse): number {
  return (resp.actions || []).reduce(
    (acc, a) => acc + (a.expected_margin_impact || 0),
    0,
  );
}

export const useSession = create<SessionState>((set) => ({
  rescuesSaved: 0,
  recoveredGbp: 0,
  marginGbp: 0,
  lastTick: 0,

  recordRespond: (resp) =>
    set((s) => {
      const margin = sumMargin(resp);
      // No realised actions ⇒ a refund, not a rescue: don't tick the saved count.
      if (!resp.actions || resp.actions.length === 0 || margin <= 0) {
        return { lastTick: s.lastTick + 1 };
      }
      return {
        rescuesSaved: s.rescuesSaved + 1,
        recoveredGbp: s.recoveredGbp + margin,
        marginGbp: s.marginGbp + margin,
        lastTick: s.lastTick + 1,
      };
    }),

  addRescue: (recoveredGbp, marginGbp) =>
    set((s) => ({
      rescuesSaved: s.rescuesSaved + 1,
      recoveredGbp: s.recoveredGbp + recoveredGbp,
      marginGbp: s.marginGbp + marginGbp,
      lastTick: s.lastTick + 1,
    })),

  reset: () => set({ rescuesSaved: 0, recoveredGbp: 0, marginGbp: 0, lastTick: 0 }),
}));
