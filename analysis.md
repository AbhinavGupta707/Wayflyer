# Pretty Fly Hackathon — Strategy & Ideas Brief

**Event:** Wayflyer × Fin Hackathon — *Build the Future of eCommerce*
**When:** Wed 3 – Fri 5 June 2026 (brief drops Wed 2pm; tools down Fri 7pm)
**Where:** Batch LDN – The Batch Members Club, 9–11 Short's Gardens, London WC2H 9AT
**Context:** Held inside the inaugural **Visionaries Summit** (a gathering of ~30 UK consumer-brand founders)
**Prizes:** £6,000 cash — £3,000 / £2,000 / £1,000 for the top three teams (+ swag)

> This document summarises the full working session: the event facts, the dataset model, sponsor worldviews, the room, the win/lose strategy analysis, the 2026 agentic frontier, and **two complete idea slates** — a first "specific-finding" analytical set and a blue-sky multi-agent set. It ends with rankings, an evidence locker, and next steps.

---

## 0. TL;DR (read this if nothing else)

1. **This is judged by the customer.** The room is ~30 UK consumer-brand founders; one judge (Jojo Regan, Manors Golf) *is* that profile. "Business value" = *would a founder in this room say "I need that for my brand."*
2. **Two sponsor gravities define what impresses:** Wayflyer = cash / margin / inventory / working-capital underwriting; Fin = AI customer-service / shopping agent.
3. **The trap:** a storefront chatbot or a support-resolution bot *rebuilds Fin's own product*. It's the obvious build and reads as redundant. Engage the Fin lane only by doing something Fin doesn't — mine conversations for upstream signal, or prevent the contact.
4. **The data reconciles end-to-end.** The winning move is not a flashy model — it's surfacing one specific, expensive thing the founder *can't currently see*, naming the SKU / date / cohort / £, and handing them the decision (or letting an agent take it).
5. **The bar for "wow" in 2026 is agentic:** multi-agent teams that observe → decide → act, agentic-commerce (agents that shop for customers), and generative-agent simulation (test a decision on a synthetic version of your own customers before risking cash).
6. **Recommended flagship:** compose the **Living Twin** (synthetic customer simulation) with the **Drop Autopilot** (autonomous drop orchestration) into one coherent system — ambitious, demo-rich, and dead-centre of both sponsors' worldviews.

---

## 1. The event at a glance

| Item | Detail |
|---|---|
| Title | Wayflyer × Fin Hackathon — Build the Future of eCommerce |
| Hosts | Wayflyer (revenue-based ecommerce financing) + Fin (AI customer service, formerly Intercom) |
| Umbrella event | Visionaries Summit (inaugural; ~30 UK consumer-brand founders, 9 panels) |
| Dates | Wed 3 → Fri 5 June 2026 |
| Brief + data pack release | Wednesday 3 June, 2:00pm |
| Tools down | Friday 5 June, 7:00pm |
| Venue | Batch LDN – The Batch Members Club, Covent Garden, London |
| Teams | 1–4 people; solo welcome; open to technical **and** non-technical |
| Prizes | £6,000 total: £3k (1st) / £2k (2nd) / £1k (3rd) + swag, food, drinks |
| Host contact | Organised by Oisin Mallon; ~98 attendees signed up |

### Submission requirements (all three are mandatory)
1. **A working demo** (live — "demos beat slides," stated repeatedly).
2. **A short write-up of architecture and trade-offs.**
3. **A 3-minute pitch** to judges (preceded by 5-minute presentations from Wayflyer and Fin).

### Judges
- **Jojo Regan** — Co-founder, Manors Golf (the *operator/founder* lens; proxy for the room).
- **Hannah Shortle** — Chief AI Lead, Wayflyer (cash / margin / inventory / underwriting).
- **Robert Davitt** — Product Lead, Fin for Ecommerce (AI support + shopping agents).

### Judging criteria
- **Execution** — does it work?
- **Business value** — would a business pay for it?
- **Demo quality** — is the pitch compelling?

### The organisers' actual motive (important)
Wayflyer's own communications describe the hackathon as a way to **surface new AI-driven tools and potential partners**, framed as **ecosystem-building that supports deal origination and underwriting insight**. Read: tools that make a merchant *more fundable / healthier* (good for Wayflyer's loan book) or that could *plug into the Wayflyer/Fin ecosystem* are rewarded.

---

## 2. The brand — "Pretty Fly"

- Fictional **London streetwear brand**: premium tees, hoodies, sweatpants, caps, trainers.
- Trading since **June 2024**. **Menswear-only** until **December 2025**, when a **small womenswear line** launched (so womenswear has only ~6 months of history).
- Data window: **1 June 2024 → 31 May 2026**. "Today" in the world = **morning of 1 June 2026**.
- Positioned as a **believable, moderately healthy** DTC brand — *not in crisis*, but carrying the normal inefficiencies any real brand has. Some are visible in the data; the strongest builds surface one an operator wouldn't have spotted and turn it into something usable.

---

## 3. The three tracks ("pick your path")

| Lane | What it covers |
|---|---|
| **Customer-facing** | Smarter storefront, support/sizing agents, post-purchase concierge, returns prediction, personalisation, loyalty. |
| **Operator-focused** | Inventory & cash forecasting, ad-efficiency triage, conversational P&L, margin diagnostics, support automation, anomaly detection. |
| **Surprise us** | Your own angle. The brief says the best builds live at the *seam* between lanes and rest on a *specific finding*, not a generic idea. |

**Organiser guidance baked into the brief:**
- Day 1 = investigation; Day 2 = building on what you found. Come back with *"we noticed that…"*, not *"we built a tool that…"*.
- Use **three tables well**, not twelve superficially.
- **AI is a tool, not the product** — judges care what you built *with* it (grounding, architecture, UX), not which model.
- **Specificity wins:** name a specific SKU, date range, customer cohort, or £-figure.

---

## 4. The dataset — structure & how it reconciles

21 files, one reconciled history. Bank ties to orders; ad spend ties to bank; PO payments tie to supplier deliveries; inventory movements tie to sales.

### Row counts

| File | Rows | File | Rows |
|---|---|---|---|
| products.csv | 62 | inventory_movements.csv | 76,444 |
| variants.csv | 645 | google_ads_daily.csv | 5,110 |
| collections.csv | 9 | meta_ads_daily.csv | 3,102 |
| product_collections.csv | 62 | email_campaigns.csv | 6 |
| customers.csv | 22,440 | email_events.csv | 11,368 |
| addresses.csv | 22,440 | support_tickets.csv | 1,204 |
| orders.csv | 49,793 | support_messages.json | 1,204 convos |
| line_items.csv | 69,956 | bank_transactions.csv | 560 |
| discount_codes.csv | 8 | suppliers.csv | 5 |
| refunds.csv | 5,843 | purchase_orders.csv | 21 |
| | | po_line_items.csv | 645 |

### The spine
`orders → line_items → variants → products`, with `customers` / `addresses` hanging off orders, and `collections` / `product_collections` describing catalogue grouping.

### The 20 reconciliation rules (from `validate.py` — the real spec)

These define exactly how the tables relate. The most build-relevant ones:

| # | Rule | Why it matters for a build |
|---|---|---|
| 1 | Order subtotal = Σ(line price × qty); `total_price = subtotal − total_discounts + total_shipping + total_tax` | The order math you'll rely on for any revenue figure. |
| 2 | Customer `total_spent` & `orders_count` reconcile to orders | Customer aggregates are trustworthy for cohorting / LTV. |
| 3 | Discount `usage_count` = orders using that code | Discount leakage analysis is clean. |
| 4 | Every line item → a `sale` inventory movement | Sales and stock are event-sourced and linked. |
| 5 | Every received PO → `po_receipt` movements | Receipts tie to inventory. |
| 6 | Every refund → a `return` movement + a bank txn; refund date is **after** order; monthly refunds = bank `SHOPIFY…REFUND` | Returns analysis is fully reconcilable; `refund_line_items` is a JSON array of returned variant IDs. |
| 7 | Σ(movements per variant) = current `inventory_quantity` | Current stock is derivable, not just stated. |
| 8–9 | Monthly Google / Meta ad spend = matching bank transactions | Spend is real and bank-verified. |
| 10 | Order UTM campaigns exist in ads/email tables | `utm_campaign` is a reliable join key. |
| 11 | Email `attributed_orders` / `revenue` reconcile to orders | Email-attributed revenue is exact. |
| 12 | Klaviyo subscription appears monthly in bank | A fixed SaaS opex line. |
| 13 | PO payments in bank = `purchase_orders.total_cost_gbp` (50/50 deposit/balance; identified by `SWIFT XFER`) | Supplier cash outflows are traceable per PO. |
| 14 | Running bank balance is internally consistent (closing = opening + Σ amounts) | You can reconstruct cash position on any date. |
| 15 | Net Sales = subtotals − discounts − refunds | P&L top line. |
| 16 | COGS = Σ(units sold × landed cost per unit), landed cost from `po_line_items` (latest PO wins) | **Gross margin is derivable per SKU.** Critical for any margin/returns/pricing build. |
| 17 | Inventory value = `inventory_quantity` × landed cost | Cash tied up in stock is computable. |
| 18 | Accounts Payable = outstanding PO balances | Supplier obligations visible. |
| 19 | Support ticket FKs (order / product / customer) all valid | Tickets are linkable to orders/products. |
| 20 | UTM campaign names consistent across orders/ads/email (bidirectional); awareness campaigns legitimately have **no** attributed orders | The attribution layer is clean and intentional. |

### Key derived facts & gotchas (these are where the "findings" hide)

- **Ad platforms overclaim conversions (~15%)** vs. what Shopify actually attributes — this is *deliberately baked in* (see rule 20 logic). True ROAS ≠ platform-claimed ROAS. Awareness campaigns having no attributed orders is *expected*, not a bug.
- **COGS is recognised on sale, not when suppliers are paid.** Compute it as units sold × landed cost.
- **Cash conversion cycle is real and reconstructable:** supplier **deposits + balance** (50/50), some invoiced in **EUR/USD**, with delivery weeks later; the running **bank balance** lets you find the exact date cash goes tight.
- **Shopify fees are embedded in payouts:** payout = gross orders − fees − refunds for that batch. Derive the fee by comparison.
- **Support:** ~**40% of tickets are bot-resolved today; 60% go to humans.** Channels: email, live chat, Instagram DM. `support_messages.json` holds **real conversations** (a rich, unique asset).
- **Banking:** `counterparty` is clean; `raw_category` is coarse (SUPPLIER, PAYROLL, SAAS, RENT, MARKETING, SHIPPING, FULFILMENT, PAYOUT, REFUND, OTHER); **`category` is deliberately blank** (finer categorisation is itself a build direction — but a thin one alone).
- **Customers** have a `gender_segment_affinity` (derived from purchase history) and an acquisition UTM (their first order's source) — useful for cohorting.
- **VAT** is inclusive in UK retail prices (a £50 tee = £8.33 VAT inside; a US customer pays £41.67 net). Export orders carry no VAT.
- **Timestamps UTC** (convert to Europe/London for local-time patterns); **currency GBP**; **discount codes case-sensitive**; `utm_campaign` is the master attribution key.

### What's NOT in the data
No real customer PII, no live API, no payment-processor data beyond Shopify, **no web analytics** (no GA / sessions / pageviews), **no images** (products described, not pictured). Generate or stub anything that needs these.

---

## 5. Sponsor worldviews (research-grounded)

### Wayflyer — revenue-based ecommerce financing
- Provides **working capital ($10k–$20m)** to ecommerce brands via merchant cash advances / term loans, repaid as a % of sales.
- **Underwrites from merchant data** — store sales, ad-platform performance, and bank data — assessing **revenue consistency, growth trend, margin resilience, and marketing efficiency**.
- Founded 2019 (Dublin); has deployed billions across thousands of brands; built a data moat from underwriting tens of thousands of merchants.
- In **2025 launched an "AI-Inventory Predictor"** that uses sales, ad, and supply-chain signals to recommend **order timing and quantities** (claimed 10–20% inventory-to-sales improvement).
- Publishes content on the **cash conversion cycle** (CCC = DIO + DSO − DPO; DTC brands typically 60–120 days).
- **Implication for builds:** anything that quantifies **cash, margin, or inventory** and turns it into a **decision** is dead-centre. A tool that produces the *underwriting/cash view from the merchant's side* flatters the sponsor and scores hard on business value.

### Fin (formerly Intercom) — the AI customer-service / shopping agent
- "#1 AI agent for customer service." **Ecommerce resolution rates ~50–65%**; resolves refunds, cancellations, address changes, product Q&A, inventory checks **with real actions** (Fin Tasks / Procedures = multi-step, rule-following).
- **Fin for Ecommerce** (Robert Davitt's product) = a **shopping assistant**: personalised recommendations, upsells, checkout guidance.
- Core metrics: **resolution rate, involvement rate, automation rate** (= involvement × resolution), **CX Score**. A "Recommendations" feature already mines unanswered tickets for content/data/action gaps.
- **Implication for builds — and the trap:** building a support-resolution chatbot **competes head-on with Fin's own product** and reads as redundant. The smart, respected move is to do what Fin *doesn't*: turn the conversation corpus into **upstream ops/margin signal**, or **prevent the contact** before it happens. Position any support build as a *layer on top of Fin*, not a replacement.

---

## 6. The room (who's actually judging "business value")

The Visionaries Summit convenes ~30 UK consumer-brand founders — a **creator-led / wellness / apparel** tilt. Named brands across the summit include **Cole Buxton** (London streetwear — Pretty Fly's near-twin), Candy Kittens, Tonic Health, Peachies, Seep, Riley Period Care, SULT, fourfiveuk, 4TH ARQ, CleanCo.

**Consequences:**
- They are **operators, not engineers.** Tone and value are judged by people who run the exact business Pretty Fly models.
- A **streetwear/apparel-native** build (drops, restocks on hyped SKUs, sizing/returns) will resonate harder than a generic one.
- The winning emotional beat is a founder thinking **"I need that for my brand right now."**

---

## 7. Strategy framework — what wins vs. what loses here

Applying the "reverse-engineer the rubric" discipline: name the obvious-but-losing pitch, then the contrarian-but-winning angle.

### Obvious losers (most teams will build these)
- A storefront **"ask-our-AI-anything" chatbot**.
- A **support-resolution bot** — you're rebuilding Fin.
- A **P&L dashboard that buckets `bank_transactions` by `raw_category`** — the brief itself calls this the "simplest first-pass."
- A **generic height/weight sizing quiz**.
- **"We used an LLM to fill the blank `category` field"** as a standalone product.
- A **churn/LTV dashboard with no action attached.**

### Contrarian winners
- **Mirror Wayflyer's cash/underwriting lens from the merchant's side** (when/how much to raise, sized to a drop).
- **Turn the support conversation corpus into upstream signal** (margin/product/ops) — Fin-complementary.
- **Attach a specific £ figure and a decision/action** to every insight.
- **Make it visually interactive** (simulators, scrubbable timelines, agents you can watch reason/act).
- **Ride the 2026 frontier**: agentic commerce + generative-agent simulation (below).

---

## 8. The 2026 frontier — what "agentic + wow" actually means now

Two trends define the ceiling for this room, and both sit inside Pretty Fly's data.

### Agentic commerce (the front-end revolution)
AI agents now **shop on behalf of consumers** and complete purchases via open protocols — **ACP** (OpenAI/Stripe/Meta) and **UCP** (Shopify/Google, backed by Amazon, Visa, Mastercard, Walmart, etc.), composing with **AP2** (payments) and **MCP** (tools).
- AI-driven orders grew **~15× in 2025**; gen-AI traffic to US retail jumped **~4,700% YoY**.
- McKinsey sizes the opportunity at **$3–5 trillion by 2030**.
- Agents **read structured product data**, not your website, to decide what to recommend — and there's **no click data**, so attribution is a brand-new problem.
- The new merchant mandate: **make sure the AI agents pick your product.** Almost no brand can see how it performs in this channel.

### Generative-agent simulation (the decision-making revolution)
LLM agent populations **calibrated on real transactional data** can simulate a brand's own customers.
- Replicate **up to ~90% of purchase-intent** responses in validated panels.
- Expected to **disrupt the $140B market-research industry in 2026** (synthetic personas / digital twins).
- Multi-agent sandboxes surface **emergent** behaviour (social dynamics, segment defection) beyond rule-based models.

### The agentic-hackathon ethos
Across recent agent hackathons, winners are systems that **observe, decide, and act autonomously** — multi-agent swarms, negotiation, browser/tool use — not passive tools. The recurring verdict: *autonomous teammates, not dashboards; and every winner ships a working demo.*

---

## 9. Idea Slate A — the "specific-finding" analytical builds (v1)

Solid, focused, fundable-feeling tools that each rest on one verifiable finding. Lower ceiling on "wow" but high on execution/business-value. *(Superseded for ambition by Slate B, kept for reference and as fallbacks.)*

1. **Capital Co-Pilot** — reconstruct the real cash-conversion cycle from bank + POs + orders; show the £ trapped and the exact date cash goes tight; simulate funding the next drop. *Wayflyer-core.*
2. **Ghost ROAS** — join ads ↔ orders ↔ landed cost to compute **true, margin-aware ROAS**, expose the ~15% platform overclaim, and recommend "pull £X from campaign A tomorrow."
3. **Return Radar** — find the specific SKU×size variants bleeding margin to returns; quantify the £; recommend an upstream fix and a pre-purchase fit nudge. *Apparel-native; bridges both lanes.*
4. **Signal from Support** — theme the support corpus, link clusters to SKUs/suppliers/POs, raise root-cause alerts with £ impact. *Fin-complementary.*
5. **Drop Oracle** — rank every variant by velocity × margin × stock-out risk × cash cost; flag stock-outs and dead stock; output a costed reorder. *Mirrors Wayflyer's inventory product.*
6. **P&L, Spoken** — an **accrual-correct** conversational CFO (COGS on sale, fees from payouts, refunds matched) that decomposes *why* margin moved. The accrual rigor is the moat vs. the lazy bank-bucketing build.

---

## 10. Idea Slate B — the blue-sky agentic builds (v2)

Every idea here is a **team of agents** with roles, a loop, and autonomy — not one model behind a chat box. Feasibility deliberately set aside; this is the "no-brainer if it existed" version.

### B1. The Living Twin — a simulated population of Pretty Fly's actual customers
- **Architecture:** Cluster 22,440 real customers into persona-agents (weighted by cohort size), each an LLM agent seeded with its real history — purchase pattern, `gender_segment_affinity`, acquisition channel, discount-inferred price sensitivity, return behaviour. A **market/environment agent** presents offers/drops/prices/emails; **persona-agents** reason, form intent, and "buy" with memory; an **analyst agent** reads emergent behaviour. Calibrate by replaying a *past* campaign and matching the real conversion number.
- **Demo wow:** A live swarm of customer-agents; drag price +10% and watch segments react — "the 1,800 SS25 discount-acquired customers defect; the 600 loyalists don't" — with a projected P&L delta and an on-screen "sim predicted 4.1%, reality was 4.3%."
- **Problem:** Brands bet cash on pricing/drops/campaigns blind; A/B tests are slow and risk real revenue. A what-if engine for the riskiest decisions — and it de-risks exactly the bets Wayflyer finances.

### B2. Agent-Experience War Room — win the shopping agents that now buy for customers
- **Architecture:** A swarm of adversarial **buyer-agents** (varied intents: "£100, minimalist black hoodie, ships Friday") shops Pretty Fly's catalogue against synthetic competitors and chooses, reasoning aloud. A **product-data optimizer agent** rewrites titles/descriptions/structured attributes to win more selections, then re-runs the gauntlet. Plus Pretty Fly's **own seller-agent** that negotiates with buyer-agents under a **hard margin floor** computed from landed cost.
- **Demo wow:** Split screen — a buyer-agent rejects the Heritage Hoodie (no fabric weight / fit stated); the optimizer rewrites it; re-run → it's chosen. "Agent-win-rate" climbs 31% → 64%. Then the seller-agent fields a discount demand and holds its floor.
- **Problem:** In an agent-mediated channel (no click data, agents read structured data), brands have **zero visibility** into how they perform. This is the future of the front end — and almost no one in the room will have built for it.

### B3. The Autonomous CFO — a multi-agent finance department
- **Architecture:** Specialist agents with **conflicting objectives** that debate. **Cash agent** forecasts runway + CCC and flags the tight date. **Margin agent** watches contribution margin by SKU/channel and alerts on erosion (FX on a PO, discount leakage). **Capital agent** runs a Wayflyer-style underwriting view from the inside and sizes the raise. **Procurement agent** optimises supplier payment timing (DPO). An **Orchestrator** reconciles their (clashing) recommendations into a weekly board pack and takes low-risk actions (categorise the blank bank field, draft the supplier email, queue the reorder).
- **Demo wow:** An ops-room feed where agents message each other live — Margin agent vetoes Cash agent's "discount to raise cash" — surface a real anomaly, debate it, converge on an action with a £ and a date; human approves → it executes.
- **Problem:** Founders run finance reactively, a bookkeeper weeks behind. An always-on finance team that turns reconciled data into decisions — and produces the underwriting lens Wayflyer uses.

### B4. Root-Cause Resolution Swarm — support that fixes the business, not the ticket
- **Architecture:** A loop **on top of Fin**. A **Resolver agent** handles tickets with real actions (refund/reship/address) grounded in order/inventory data; every resolution feeds a **Root-Cause agent** clustering symptoms to systemic causes (a SKU runs small, PO-014's batch is faulty, a carrier delays a region). A **Fix agent** acts upstream (drafts the supplier QC complaint, proposes the size-guide edit, flags the SKU to reorder). A **Proactive agent** finds other customers on the faulty batch and reaches out *before* they complain. The system scores its own **deflection** (future tickets / £ refunds prevented).
- **Demo wow:** Three zipper complaints → linked to PO-014 → supplier complaint drafted → 40 affected customers identified → proactive prepaid-replacement drafted → a live "tickets prevented / £ saved" counter.
- **Problem:** Support is run as ticket-closing; the value is the systemic signal and prevention (sizing drives ~half of apparel returns; one bad fit costs ~a third of customers). Complements Fin rather than competing.

### B5. Drop Autopilot — autonomous, end-to-end drop orchestration
- **Architecture:** A planning swarm that reconciles each other's constraints. **Demand agent** forecasts drop demand by SKU/size. **Allocation agent** sets the size curve using *actual return data* (don't over-make the size that comes back most). **Cash agent** confirms fundability and times the supplier deposit against runway. **Marketing agent** splits launch budget across Google/Meta/email by predicted true mROAS and drafts assets for the right cohorts. **Pricing agent** sets launch price against the margin floor (can pre-test via the Living Twin). An **Orchestrator** runs the timeline and post-mortem.
- **Demo wow:** "Plan the SS26 hoodie drop" → agents negotiate live (Cash caps at 1,200 units; Demand insists M/L sell out + supplies the curve; Marketing allocates £3k, 70% to Meta retargeting SS25) → a fully costed, dated drop plan with projected sell-through, margin, stock-out forecast, and drafted campaign.
- **Problem:** Drops are planned on gut across disconnected functions. One planner respecting cash, demand, returns, and margin at once is a no-brainer for any DTC brand — the "seam between lanes" build.

### B6. Counterfactual Time Machine — autonomous post-mortem on 24 months (wildcard)
- **Architecture:** Because the data reconciles end-to-end, a **simulation agent** re-runs history under different decisions while a **causal agent** isolates the driver and a **narrator** quantifies it. "What if we'd never run BANKHOLIDAY20?" "What if we'd reordered the Washed Black hoodie before it stocked out?" Each lesson becomes a forward rule the other agents adopt.
- **Demo wow:** A dual-timeline chart (actual vs. counterfactual cash/revenue) — "skipping the March over-discounting adds £X and erases the April cash dip" — plus "rule learned: cap promo depth at N%."
- **Problem:** Brands never quantify the cost of their own past calls or learn from them systematically. Institutional memory as an agent — and a natural learning backbone behind B1/B3/B5.

---

## 11. Recommendations & ranking

| Pick | Why |
|---|---|
| **B2 Agent-Experience War Room** | Boldest, most on-trend; the literal future of the storefront; pure FOMO for the founders. Highest ceiling on "demo quality" and originality. |
| **B1 Living Twin** | Most defensible "future of decision-making" story; demos beautifully; validates against real data; de-risks Wayflyer-financed bets. |
| **B5 Drop Autopilot** | Most viscerally useful to an apparel room; cross-functional; subsumes several simpler tools. |
| **B3 Autonomous CFO** | Most directly Wayflyer-aligned; multi-agent debate is a strong demo; "business value" is obvious. |
| **B4 Root-Cause Swarm** | Smartest way to engage the Fin lane *without* competing with Fin. |

**Suggested flagship:** **B1 + B5 composed.** The Living Twin becomes the simulation core the Drop Autopilot tests its plan against — one ambitious, coherent system rather than a scattering of features. It hits all three criteria (works / pay-for-it / compelling demo) and both sponsor worldviews at once.

**Closing worldview for the pitch:** *The dataset reconciles, so the frontier isn't a smarter dashboard — it's giving the brand a sandbox to act and a team of agents to act in it, so every expensive decision gets rehearsed and de-risked before a pound moves.*

---

## 12. Evidence locker (verifiable facts used)

Use these to anchor a pitch with hard numbers — *specificity wins*.

**Returns / apparel**
- Average ecommerce return rate ~19–20% in 2026; **apparel runs ~25–40%**.
- **Sizing/fit drives ~45–77% of apparel returns** (commonly cited ~53%).
- Cost per return ~$15–25 (before unsellable stock).
- **~32% of customers abandon a brand after one bad-fit experience.**

**Cash conversion cycle**
- CCC = DIO + DSO − DPO; **DTC brands typically 60–120 days** (Wayflyer's own framing).
- Every day of CCC reduction frees real working capital; profitable P&Ls routinely produce no cash because it's trapped in the cycle.

**Fin / support**
- Fin ecommerce resolution **~50–65%** (overall ~67%); processes refunds, cancellations, address changes with actions.
- Pretty Fly sits at **~40% bot-resolved** today — headroom to the benchmark is a quantifiable story.

**Agentic commerce**
- AI-driven orders grew **~15× in 2025**; gen-AI retail traffic **~4,700% YoY**.
- Opportunity sized at **$3–5T by 2030** (McKinsey).
- Agents read structured product data; **no click data** → new attribution problem.

**Generative-agent simulation**
- Calibrated LLM agent panels replicate **~90% of purchase-intent**.
- Expected to **disrupt the $140B market-research industry in 2026**.

**Dataset-internal (from the brief + validator)**
- Ad platforms **overclaim ~15%** vs. Shopify attribution (intentional).
- Womenswear launched **Dec 2025** (~6 months of data).
- Gross margin per SKU is derivable (COGS = units × landed cost).

---

## 13. Sources

- Event page — Luma: `https://luma.com/v4bzvbka`
- Wayflyer financing & underwriting: `wayflyer.com/en/how-our-financing-offers-work`; `ntropy.com` Wayflyer case study; `businessmodelcanvastemplate.com` (AI-Inventory Predictor)
- Wayflyer cash conversion cycle: `wayflyer.com/blog/ecommerce-cash-conversion-cycle-working-capital-management`; `eightx.co`; `ask-luca.com`
- Visionaries Summit / hackathon coverage: TipRanks ("Wayflyer Amplifies Visionaries Summit and AI Hackathon…")
- Fin / Intercom: `fin.ai/solutions/ecommerce`; `fin.ai/learn/ai-agents-in-customer-service`; `intercom.com/help` (Fin AI Agent explained, automation rate)
- Returns economics: `richpanel.com`, `eightx.co`, `prime-ai.com`, `fitezapp.com`, `wearview.co`
- Agentic commerce: `shopify.com/blog/agentic-commerce`, `shopify.com/blog/how-agentic-commerce-works`, `gr4vy.com`, `opascope.com`, `eco.com`
- Generative-agent simulation: arXiv 2510.18155; `bain.com`, `pymc-labs.com`, `success.com`, `askrally.com`, `sierra.ai`
- Agent hackathon ethos: Microsoft AI Agents Hackathon 2025; Kong Agentic AI Hackathon 2025; Agno Global Agent Hackathon

---

## 14. Open questions / next steps

1. **Lane & team:** Which lane are you leaning, and is the team more *builder* or *operator*? That decides whether to chase a slick agent demo (B2) or a sharp analytical insight + agentic wrapper (B1/B3).
2. **Flagship decision:** Single bold bet (B2) or composed system (B1+B5)?
3. **Data dive (the real next step):** Point me at the CSVs and I'll run the Day-1 investigation — reconstruct the CCC and find the exact cash-trough date, compute true vs. claimed ROAS per campaign, profile the womenswear cohort, and surface the worst return-rate SKUs — so the build rests on a *named £ figure* from the actual data.
4. **Architecture spec:** Once a flagship is chosen, I can spec the agent roles, the orchestration graph, the tools each agent calls, and the exact tables each agent reads.

---

*Prepared as a working strategy brief. Pretty Fly, Wayflyer, and Fin data referenced here is fictional per the hackathon pack; external figures are sourced above.*
