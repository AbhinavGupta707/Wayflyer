"""In-memory voice session state + the bridge back to /respond.

A session ties a rescue_id (and, for phone calls, a Twilio call SID) to the
spoken offer and the synthesized audio, so the Twilio webhook can look the offer
up and so a "yes" routes acceptance through the SAME confirmation path the chat
flow uses (POST /api/rescue/{id}/respond).

This is demo-grade (process-local, single worker). Fine for the stage.
"""
from __future__ import annotations
from typing import Optional

from .offer import VoiceOffer, build_offer

# rescue_id -> session dict
_sessions: dict[str, dict] = {}
# rescue_id -> synthesized offer audio (mp3 bytes) for Twilio <Play>
_audio: dict[str, bytes] = {}
# twilio call_sid -> rescue_id
_sid_index: dict[str, str] = {}


def open_session(rescue_id: str, channel: str, offer_text: Optional[str] = None) -> VoiceOffer:
    offer = build_offer(rescue_id, offer_text=offer_text)
    _sessions[rescue_id] = {
        "rescue_id": rescue_id,
        "channel": channel,
        "offer": offer,
        "status": "ready",       # ready | calling | speaking | accepted | declined | failed
        "call_sid": None,
        "accepted": None,
    }
    return offer


def get_session(rescue_id: str) -> Optional[dict]:
    return _sessions.get(rescue_id)


def get_offer(rescue_id: str) -> VoiceOffer:
    s = _sessions.get(rescue_id)
    if s:
        return s["offer"]
    return open_session(rescue_id, channel="adhoc")


def set_status(rescue_id: str, status: str) -> None:
    s = _sessions.get(rescue_id)
    if s:
        s["status"] = status


def bind_call(rescue_id: str, call_sid: str) -> None:
    s = _sessions.get(rescue_id)
    if s:
        s["call_sid"] = call_sid
    _sid_index[call_sid] = rescue_id


def rescue_for_sid(call_sid: str) -> Optional[str]:
    return _sid_index.get(call_sid)


def put_audio(rescue_id: str, mp3: bytes) -> None:
    _audio[rescue_id] = mp3


def get_audio(rescue_id: str) -> Optional[bytes]:
    return _audio.get(rescue_id)


def route_acceptance(rescue_id: str, accepted: bool) -> dict:
    """Fire the same confirmation path as the chat flow: POST /respond.

    Done in-process (late import) so voice never invents its own confirmation —
    whatever WS2/WS3 wire into /respond is exactly what the caller hears.
    """
    s = _sessions.get(rescue_id)
    if s:
        s["accepted"] = accepted
        s["status"] = "accepted" if accepted else "declined"
    try:
        from .. import main as _m
        return _m.respond(rescue_id, {"accepted": accepted})
    except Exception as e:  # pragma: no cover
        return {"actions": [], "confirmation": "", "error": str(e)}
