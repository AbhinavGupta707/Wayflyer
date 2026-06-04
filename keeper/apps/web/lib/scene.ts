// Keeper scene controller — drives Customer → Agent → Customer transitions.
//
// This is the demo's "glue": one shared store that both WS4 (customer/store UI)
// and WS5 (agent view) wire into so the three scenes hand off cleanly.
//
//   WS4 store page:   onOpenAgentView={(id) => useScene.getState().openAgentView(id)}
//   WS5 agent view:   onReturnToCustomer={() => useScene.getState().returnToCustomer()}
//
// Or, idiomatically, inside a component:
//   const { openAgentView } = useScene();
//
// Render side (the demo shell) reads `scene` + `direction` and wraps its two
// panes in <AnimatePresence mode="popLayout"> using the variants exported below
// for the shared-layout "zoom into the agent's mind" effect.

import { create } from "zustand";
import type { Transition, Variants } from "framer-motion";

export type Scene = "customer" | "agent";

/** forward = customer→agent (zoom in); back = agent→customer (zoom out). */
export type SceneDirection = "forward" | "back";

interface SceneState {
  scene: Scene;
  /** Rescue currently under the lens (null on the customer scene before a handoff). */
  activeRescueId: string | null;
  direction: SceneDirection;

  /** WS4 → controller: zoom into the agent's reasoning for this rescue. */
  openAgentView: (rescueId: string) => void;
  /** WS5 → controller: zoom back out to the customer conversation. */
  returnToCustomer: () => void;
  /** Hard reset to the opening scene (e.g. "run the demo again"). */
  reset: () => void;
}

export const useScene = create<SceneState>((set) => ({
  scene: "customer",
  activeRescueId: null,
  direction: "forward",

  openAgentView: (rescueId) =>
    set({ scene: "agent", activeRescueId: rescueId, direction: "forward" }),

  returnToCustomer: () => set({ scene: "customer", direction: "back" }),

  reset: () => set({ scene: "customer", activeRescueId: null, direction: "forward" }),
}));

// --- Selectors (stable references; avoid re-renders from picking the whole store) ---
export const selectScene = (s: SceneState) => s.scene;
export const selectActiveRescueId = (s: SceneState) => s.activeRescueId;
export const selectDirection = (s: SceneState) => s.direction;

// --- Framer Motion choreography: shared-layout "zoom into the agent's mind" ---
// Going forward, the customer pane recedes/blurs while the agent pane zooms up
// from the focal point. Going back reverses it. Drive with a `custom` prop:
//   <motion.div custom={direction} variants={sceneVariants} ... />

export const sceneTransition: Transition = {
  type: "spring",
  stiffness: 260,
  damping: 30,
  mass: 0.9,
};

/** Variants for the AGENT pane (the one being zoomed into). */
export const agentSceneVariants: Variants = {
  initial: (dir: SceneDirection) => ({
    opacity: 0,
    scale: dir === "forward" ? 0.82 : 1.06,
    filter: "blur(8px)",
  }),
  animate: { opacity: 1, scale: 1, filter: "blur(0px)" },
  exit: (dir: SceneDirection) => ({
    opacity: 0,
    scale: dir === "back" ? 0.82 : 1.06,
    filter: "blur(8px)",
  }),
};

/** Variants for the CUSTOMER pane (recedes as we zoom into the mind). */
export const customerSceneVariants: Variants = {
  initial: (dir: SceneDirection) => ({
    opacity: 0,
    scale: dir === "back" ? 0.94 : 1.04,
    filter: "blur(6px)",
  }),
  animate: { opacity: 1, scale: 1, filter: "blur(0px)" },
  exit: (dir: SceneDirection) => ({
    opacity: 0,
    scale: dir === "forward" ? 1.08 : 0.96,
    filter: "blur(6px)",
  }),
};
