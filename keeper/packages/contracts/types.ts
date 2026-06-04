// Keeper FROZEN CONTRACTS (TypeScript) — mirror of schemas.py. Keep in lock-step.
// Contract A: domain | Contract B: API | Contract C: agent step stream.

// ===================== Contract A — domain / feature store =====================
export interface Passport {
  customer_id: string;
  name: string;
  email: string;
  ltv: number;
  orders_count: number;
  country: string;
  segment: string;
  acquisition: string;
  discount_sensitivity: number;
  sizes_kept: Record<string, string[]>;
  sizes_returned: { product_type: string; size: string; reason: string }[];
  email_engaged: boolean;
  contactable: boolean;
}

export interface SkuGenome {
  product_id: string;
  title: string;
  product_type: string;
  size_ladder: string[];
  units_sold: number;
  returns: number;
  return_rate: number;
  reason_skew: Record<string, number>;
  runs: "small" | "large" | "none";
  price: number;
  landed_cost: number;
  margin_per_unit: number;
  current_stock_by_size: Record<string, number>;
}

export interface Sibling { variant_id: string; size: string; stock: number; price: number; }
export interface ExchangeOption { to_size: string; to_variant: string; recovered_gbp: number; margin_gbp: number; }
export interface Economics {
  refund_value: number;
  recommended: "exchange" | "store_credit" | "refund" | "waitlist";
  exchange?: ExchangeOption | null;
}
export interface ReturnedItem {
  variant_id: string; product_id: string; title: string; size: string; price: number; landed_cost: number;
}
export interface RescueCase {
  rescue_id: string;
  customer_id: string;
  order_id: string;
  returned: ReturnedItem;
  reason_label: string;
  reason_text: string;
  passport: Passport;
  genome: SkuGenome;
  siblings_in_stock: Sibling[];
  economics: Economics;
}

export interface Decision {
  branch: "fit_exchange" | "fast_refund" | "crosssell_or_refund";
  action: "exchange" | "refund" | "waitlist";
  to_size?: string | null;
  recoverable: boolean;
  recovered_gbp: number;
  margin_gbp: number;
  rationale: string;
  requires_approval: boolean;
}

export type ActionType =
  | "create_exchange" | "reserve_inventory" | "process_refund" | "issue_store_credit"
  | "make_voice_call" | "send_message" | "create_waitlist"
  | "publish_size_chart_patch" | "flag_to_buying" | "draft_supplier_note";

export interface ActionObject {
  action_type: ActionType;
  rescue_id?: string;
  payload?: Record<string, unknown>;
  expected_margin_impact?: number;
  requires_approval?: boolean;
  status?: "queued" | "running" | "done" | "skipped";
  real?: boolean;
}

// ===================== Contract C — agent step-event stream =====================
export interface StepEvent {
  seq: number;
  agent: string;
  label: string;
  kind: "reasoning" | "compute" | "tool" | "decision";
  status: "thinking" | "streaming" | "done";
  thinking?: string | null;
  result?: Record<string, unknown> | null;
  node_edge?: [string, string] | null;
  latency_ms?: number | null;
}
export interface DecisionEvent {
  seq: number;
  kind: "decision";
  status: "done";
  decision: Decision;
  actions_preview: ActionObject[];
}
export type StreamEvent = StepEvent | DecisionEvent;

// ===================== Contract B — API request/response =====================
export interface ReturnIntakeRequest { order_id: string; variant_id: string; reason_text?: string; channel?: "chat" | "voice"; }
export interface RescueIdResponse { rescue_id: string; }
export interface RespondRequest { accepted: boolean; }
export interface RespondResponse { actions: ActionObject[]; confirmation: string; }
export interface LedgerSummary {
  total_refunds: number;
  size_refunds: number;
  size_refund_gbp: number;
  addressable_count: number;
  addressable_recovered_gbp: number;
  addressable_margin_gbp: number;
  accept_rate_assumed: number;
  realistic_recovered_gbp: number;
  realistic_margin_gbp: number;
  top_skus: Record<string, unknown>[];
  by_month: Record<string, number>;
}
