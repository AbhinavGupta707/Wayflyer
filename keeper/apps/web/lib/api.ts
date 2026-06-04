// Keeper typed API client (Contract B + C).
// Every workstream imports from here — keep the surface stable.
//
// Base URL: NEXT_PUBLIC_API_BASE (default http://localhost:8000). The mock API
// (keeper/apps/api) sets CORS allow-origin "*", so direct cross-origin calls work
// in dev with no proxy. WS3/WS2 swap the server impl behind the same paths.

import type {
  HealthResponse,
  LedgerSummary,
  SkuGenome,
  RescueCase,
  RescueIdResponse,
  RespondRequest,
  RespondResponse,
  StreamEvent,
  DemoCustomer,
  CustomerOrders,
} from "./types";

export interface IntakeBody {
  variant_id?: string;
  product_id?: string;
  size?: string;
  reason: string;
  customer_id?: string;
  order_id?: string;
}

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, "") || "http://localhost:8000";

export function wsBase(): string {
  return API_BASE.replace(/^http/, "ws");
}

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

async function postJSON<TReq, TRes>(path: string, body: TReq): Promise<TRes> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} → ${res.status}`);
  return res.json() as Promise<TRes>;
}

export const api = {
  health: () => getJSON<HealthResponse>("/api/health"),
  ledger: () => getJSON<LedgerSummary>("/api/ledger"),
  catalog: () => getJSON<SkuGenome[]>("/api/catalog"),
  rescue: (id: string) => getJSON<RescueCase>(`/api/rescue/${id}`),

  customers: () => getJSON<DemoCustomer[]>("/api/customers"),
  customerOrders: (id: string) => getJSON<CustomerOrders>(`/api/customers/${id}/orders`),

  intake: (body: IntakeBody) =>
    postJSON<IntakeBody, RescueIdResponse>("/api/returns/intake", body),

  respond: (id: string, body: RespondRequest) =>
    postJSON<RespondRequest, RespondResponse>(`/api/rescue/${id}/respond`, body),
};

/**
 * Subscribe to the agent step-event stream for a rescue (Contract C).
 * Returns an unsubscribe fn. WS5 renders these events; WS7 just exposes the wire.
 */
export function subscribeStream(
  rescueId: string,
  onEvent: (ev: StreamEvent) => void,
  opts?: { onOpen?: () => void; onClose?: () => void; onError?: (e: Event) => void },
): () => void {
  const ws = new WebSocket(`${wsBase()}/api/rescue/${rescueId}/stream`);
  ws.onopen = () => opts?.onOpen?.();
  ws.onmessage = (msg) => {
    try {
      onEvent(JSON.parse(msg.data) as StreamEvent);
    } catch {
      /* ignore malformed frame */
    }
  };
  ws.onerror = (e) => opts?.onError?.(e);
  ws.onclose = () => opts?.onClose?.();
  return () => {
    try {
      ws.close();
    } catch {
      /* already closed */
    }
  };
}

// Query keys for React Query — shared so cache invalidation lines up across pages.
export const qk = {
  health: ["health"] as const,
  ledger: ["ledger"] as const,
  catalog: ["catalog"] as const,
  rescue: (id: string) => ["rescue", id] as const,
  customers: ["customers"] as const,
  customerOrders: (id: string) => ["customerOrders", id] as const,
};
