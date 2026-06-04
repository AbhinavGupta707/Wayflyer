// Tiny class-merge helper, local to the agent view (clsx + tailwind-merge are
// already in package.json). Kept under components/agent-* to stay in WS5's lane.
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
