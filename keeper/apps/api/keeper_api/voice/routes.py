"""WS6 Voice routes (Contract B extension).

    POST /api/rescue/{id}/voice/start     initiate widget seed OR real phone call
    GET  /api/rescue/{id}/voice/offer     the spoken-offer payload
    GET  /api/voice/audio/{id}.mp3        ElevenLabs-synthesized offer (Twilio <Play>)
    POST /api/voice/twilio/webhook        TwiML: speak offer + gather yes/no
    POST /api/voice/twilio/gather         handle yes/no -> /respond -> confirm TwiML
    POST /api/voice/twilio/status         call status callback (best-effort)
    POST /api/voice/accept                browser-widget / agent-tool acceptance hook
    GET  /api/voice/health                which integrations are live

A "yes" on any channel funnels through state.route_acceptance(), which calls the
SAME POST /api/rescue/{id}/respond path the chat flow uses — voice never invents
its own confirmation.
"""
from __future__ import annotations
from urllib.parse import parse_qs

from fastapi import APIRouter, Request, Response
from fastapi.responses import JSONResponse

from . import config, state
from .elevenlabs_client import get_signed_url, tts
from .twilio_client import TwilioError, place_call, twiml_offer, twiml_say

router = APIRouter()

_POS = ("yes", "yeah", "yep", "yup", "sure", "please", "ok", "okay", "go ahead",
        "do it", "set that up", "sounds good", "absolutely", "correct")
_NEG = ("no", "nope", "nah", "don't", "do not", "cancel", "just refund", "refund")


def _classify(speech: str, digits: str) -> str | None:
    """Return 'yes' | 'no' | None (unclear) from a Twilio Gather result."""
    if digits == "1":
        return "yes"
    if digits == "2":
        return "no"
    s = (speech or "").lower()
    # check negatives first ("no thanks", "just refund" should not match 'ok')
    if any(t in s for t in _NEG):
        return "no"
    if any(t in s for t in _POS):
        return "yes"
    return None


async def _form(request: Request) -> dict:
    """Parse a Twilio webhook body (application/x-www-form-urlencoded) with the
    stdlib, so we don't pull in python-multipart just for these callbacks."""
    raw = await request.body()
    parsed = parse_qs(raw.decode("utf-8", "ignore"), keep_blank_values=True)
    return {k: v[-1] for k, v in parsed.items()}


def _public(path: str) -> str:
    """Build a Twilio-reachable absolute URL (needs PUBLIC_BASE_URL / ngrok)."""
    base = config.PUBLIC_BASE_URL or config.SELF_BASE_URL
    return f"{base}{path}"


# ----------------------------- start / offer -----------------------------

@router.post("/api/rescue/{rescue_id}/voice/start")
async def voice_start(rescue_id: str, body: dict | None = None):
    body = body or {}
    channel = (body.get("channel") or "widget").lower()
    offer_text = body.get("offer_text")  # optional override (e.g. fresh concierge draft)
    offer = state.open_session(rescue_id, channel=channel, offer_text=offer_text)

    if channel in ("widget", "browser", "elevenlabs"):
        signed_url = get_signed_url()  # None for public agents / no key — that's fine
        return {
            "mode": "widget",
            "rescue_id": rescue_id,
            "agent_id": config.ELEVENLABS_AGENT_ID or None,
            "signed_url": signed_url,
            "dynamic_variables": offer.dynamic_variables,
            "offer": offer.model_dump(),
            "configured": config.elevenlabs_widget_configured(),
            "accept_url": f"/api/voice/accept",
        }

    if channel in ("phone", "twilio", "call"):
        to_number = body.get("to_number") or config.DEMO_TO_NUMBER
        # Pre-synthesize the ElevenLabs voice so the call plays a real voice.
        if not state.get_audio(rescue_id):
            audio = tts(offer.script)
            if audio:
                state.put_audio(rescue_id, audio)
        if not config.PUBLIC_BASE_URL:
            return JSONResponse(
                status_code=409,
                content={"mode": "phone", "error": "PUBLIC_BASE_URL not set — Twilio "
                         "cannot reach the webhook. Start an ngrok tunnel and set it.",
                         "offer": offer.model_dump()},
            )
        answer_url = _public(f"/api/voice/twilio/webhook?rescue_id={rescue_id}")
        status_url = _public(f"/api/voice/twilio/status?rescue_id={rescue_id}")
        try:
            sid = place_call(to_number, answer_url, status_url)
        except TwilioError as e:
            state.set_status(rescue_id, "failed")
            return JSONResponse(status_code=409,
                                content={"mode": "phone", "error": str(e),
                                         "offer": offer.model_dump()})
        state.bind_call(rescue_id, sid)
        state.set_status(rescue_id, "calling")
        return {"mode": "phone", "rescue_id": rescue_id, "call_sid": sid,
                "to": to_number, "status": "calling", "offer": offer.model_dump()}

    return JSONResponse(status_code=400, content={"error": f"unknown channel '{channel}'"})


@router.get("/api/rescue/{rescue_id}/voice/offer")
async def voice_offer(rescue_id: str):
    return state.get_offer(rescue_id).model_dump()


@router.get("/api/voice/audio/{rescue_id}.mp3")
async def voice_audio(rescue_id: str):
    audio = state.get_audio(rescue_id)
    if audio is None:
        audio = tts(state.get_offer(rescue_id).script)
        if audio:
            state.put_audio(rescue_id, audio)
    if not audio:
        return JSONResponse(status_code=404, content={"error": "no audio (ElevenLabs not configured)"})
    return Response(content=audio, media_type="audio/mpeg",
                    headers={"Cache-Control": "no-store"})


# ----------------------------- Twilio webhooks -----------------------------

def _rescue_id_from(request: Request, form: dict, call_sid: str = "") -> str:
    return (request.query_params.get("rescue_id")
            or form.get("rescue_id")
            or (call_sid and state.rescue_for_sid(call_sid))
            or "rsc_demo_0001")


@router.post("/api/voice/twilio/webhook")
async def twilio_webhook(request: Request):
    form = await _form(request)
    call_sid = form.get("CallSid", "")
    rescue_id = _rescue_id_from(request, form, call_sid)
    if call_sid:
        state.bind_call(rescue_id, call_sid)
    state.set_status(rescue_id, "speaking")
    offer = state.get_offer(rescue_id)

    # Play the real ElevenLabs voice if we have (or can make) the audio; the
    # TwiML <Play> points back at our /audio endpoint. Else Twilio <Say>.
    if state.get_audio(rescue_id) is None:
        audio = tts(offer.script)
        if audio:
            state.put_audio(rescue_id, audio)
    play_url = _public(f"/api/voice/audio/{rescue_id}.mp3") if state.get_audio(rescue_id) else None

    twiml = twiml_offer(
        gather_action=_public(f"/api/voice/twilio/gather?rescue_id={rescue_id}"),
        play_url=play_url,
        say_text=offer.script,
    )
    return Response(content=twiml, media_type="application/xml")


@router.post("/api/voice/twilio/gather")
async def twilio_gather(request: Request):
    form = await _form(request)
    call_sid = form.get("CallSid", "")
    rescue_id = _rescue_id_from(request, form, call_sid)
    offer = state.get_offer(rescue_id)
    verdict = _classify(form.get("SpeechResult", ""), form.get("Digits", ""))

    if verdict == "yes":
        result = state.route_acceptance(rescue_id, True)
        line = result.get("confirmation") or offer.confirm_line
        return Response(content=twiml_say(line), media_type="application/xml")
    if verdict == "no":
        state.route_acceptance(rescue_id, False)
        return Response(content=twiml_say(offer.decline_line), media_type="application/xml")

    # Unclear -> ask once more by replaying the offer webhook.
    retry = twiml_say("Sorry, I didn't catch that.", hangup=False)
    retry = retry.replace("</Response>",
                          f'<Redirect method="POST">'
                          f'{_public(f"/api/voice/twilio/webhook?rescue_id={rescue_id}")}'
                          f'</Redirect></Response>')
    return Response(content=retry, media_type="application/xml")


@router.post("/api/voice/twilio/status")
async def twilio_status(request: Request):
    form = await _form(request)
    rescue_id = _rescue_id_from(request, form, form.get("CallSid", ""))
    cs = form.get("CallStatus")
    if cs in ("completed", "failed", "busy", "no-answer", "canceled"):
        s = state.get_session(rescue_id)
        if s and s.get("status") in ("calling", "speaking"):
            state.set_status(rescue_id, "failed" if cs != "completed" else s["status"])
    return Response(content="<?xml version=\"1.0\"?><Response/>", media_type="application/xml")


# -------------------- browser widget / agent-tool hook --------------------

@router.post("/api/voice/accept")
async def voice_accept(body: dict | None = None):
    """Acceptance from the ElevenLabs browser widget (Yes button or agent tool).

    body: {rescue_id, accepted}. Routes through the same /respond path.
    """
    body = body or {}
    rescue_id = body.get("rescue_id") or "rsc_demo_0001"
    accepted = bool(body.get("accepted", True))
    result = state.route_acceptance(rescue_id, accepted)
    return {"rescue_id": rescue_id, "accepted": accepted, **result}


@router.get("/api/voice/health")
async def voice_health():
    return {"ok": True, **config.status()}
