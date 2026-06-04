# WS6 — Voice

The fit-concierge that **speaks the already-decided offer** and routes a "yes"
back through the same confirmation path as chat. Voice narrates; the engine owns
every number (CONTRACTS.md hard rule).

## Endpoints (Contract B extension)
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/rescue/{id}/voice/start` | seed the browser widget **or** place a real phone call. Body `{channel:"widget"\|"phone", to_number?, offer_text?}` |
| GET | `/api/rescue/{id}/voice/offer` | the spoken-offer payload (`VoiceOffer`) |
| GET | `/api/voice/audio/{id}.mp3` | ElevenLabs-synthesized offer (Twilio `<Play>` + UI clip) |
| POST | `/api/voice/twilio/webhook` | TwiML: speak offer + gather yes/no |
| POST | `/api/voice/twilio/gather` | yes → `/respond` → confirm TwiML; no → refund line |
| POST | `/api/voice/twilio/status` | call status callback (best-effort) |
| POST | `/api/voice/accept` | widget/agent-tool acceptance hook → `/respond` |
| GET | `/api/voice/health` | which integrations are live |

## Three reliability layers (degrade gracefully, no keys required to boot)
1. **Text transcript + Yes/No buttons** — always works (the `<VoiceWidget>` core).
2. **ElevenLabs Conversational-AI widget** — when `ELEVENLABS_AGENT_ID` is set.
3. **Real Twilio outbound call** — when Twilio + `PUBLIC_BASE_URL` (ngrok) are set.
   The call plays the **ElevenLabs voice** (pre-synthesized clip via `<Play>`),
   falling back to Twilio `<Say>` if TTS is unavailable.
Plus a pre-rendered `audio/{id}.mp3` clip as the on-stage fallback.

## Web component (WS4 mounts this)
`apps/web/components/voice-widget.tsx` — `<VoiceWidget rescueId apiBase onAccepted />`.
`apps/web/components/voice-demo.html` — zero-build standalone page (stage fallback):
`python3 -m http.server 5500` then `…/voice-demo.html?api=http://localhost:8000&id=rsc_demo_0001`.

## Stage setup
```bash
cp keeper_api/voice/.env.example .env   # fill ElevenLabs + Twilio keys
ngrok http 8000                         # -> set PUBLIC_BASE_URL to the https URL
uvicorn keeper_api.main:app --reload --port 8000
# widget:  curl -XPOST localhost:8000/api/rescue/rsc_demo_0001/voice/start -d '{"channel":"widget"}' -H 'content-type: application/json'
# call:    curl -XPOST localhost:8000/api/rescue/rsc_demo_0001/voice/start -d '{"channel":"phone","to_number":"+3538…"}' -H 'content-type: application/json'
```
Done = the phone rings / widget speaks the Court Trainer UK8 offer; **"yes"** →
`POST /api/rescue/{id}/respond {accepted:true}` fires and the ledger confirmation returns.
