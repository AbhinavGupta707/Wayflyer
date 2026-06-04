# WS6 — Voice (the live wow moment)

**Mission:** the fit-concierge that calls/answers and speaks the **already-decided** offer.
**Owns:** `apps/api/keeper_api/voice/`  (+ a small web widget mount under `apps/web/components/voice-*`)
**Reads:** Contract B. The offer text comes from the agent/engine — voice only narrates + handles yes/no.

## Build
1. **Primary (reliable):** ElevenLabs Conversational AI **browser widget** embedded in the customer view,
   seeded with the decided offer + customer name. Handles "yes/no/tell me more".
2. **Showstopper:** real outbound **Twilio Programmable Voice** call to a phone on stage; ElevenLabs voice;
   **ngrok** tunnel for the Twilio webhook → `POST /api/voice/twilio/webhook`.
3. Endpoint `POST /api/rescue/{id}/voice/start` → initiates the call/widget with the offer payload.
4. On "yes" → call `POST /api/rescue/{id}/respond {accepted:true}` so the same confirmation path fires.
5. **Fallback:** pre-recorded clip if telephony flakes on stage (have it ready).

## Keys (.env)
`ELEVENLABS_API_KEY`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_NUMBER`.

## Run / verify
Trigger `/voice/start` for `rsc_demo_0001`; the phone rings / widget speaks the UK8 offer; "yes" → confirmation.

## Done =
A real voice interaction speaks the Court Trainer offer and routes acceptance back through `/respond`.

## Don't touch
`engine/`, `etl/`, `app/store`+`app/agent` page logic (only mount your widget component), contracts.
