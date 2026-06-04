"""Thin ElevenLabs helpers over the REST API (stdlib urllib — no SDK hard-dep).

Two things WS6 needs from ElevenLabs:
  • get_signed_url(agent_id)  — a short-lived URL so the browser widget can talk
    to a *private* Conversational-AI agent without exposing the API key.
  • tts(text)                 — synthesize the offer to mp3 bytes so the Twilio
    call plays the real ElevenLabs voice (cached per rescue in state.py).

Both return None on any failure so callers can fall back cleanly (text widget /
Twilio <Say>) rather than crash the demo.
"""
from __future__ import annotations
import json
import urllib.request
import urllib.error
from typing import Optional

from . import config

_API = "https://api.elevenlabs.io/v1"


def _request(url: str, *, method: str = "GET", data: Optional[bytes] = None,
             headers: Optional[dict] = None, timeout: int = 20) -> Optional[bytes]:
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("xi-api-key", config.ELEVENLABS_API_KEY)
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.read()
    except (urllib.error.URLError, urllib.error.HTTPError, OSError):
        return None


def get_signed_url(agent_id: Optional[str] = None) -> Optional[str]:
    """Signed conversation URL for the browser widget (private agents)."""
    agent_id = agent_id or config.ELEVENLABS_AGENT_ID
    if not (config.elevenlabs_configured() and agent_id):
        return None
    raw = _request(
        f"{_API}/convai/conversation/get-signed-url?agent_id={agent_id}",
        headers={"Accept": "application/json"},
    )
    if not raw:
        return None
    try:
        return json.loads(raw.decode("utf-8")).get("signed_url")
    except (ValueError, AttributeError):
        return None


def tts(text: str, voice_id: Optional[str] = None) -> Optional[bytes]:
    """Synthesize `text` to mp3 bytes via ElevenLabs, or None on failure."""
    if not config.elevenlabs_configured() or not text:
        return None
    voice_id = voice_id or config.ELEVENLABS_VOICE_ID
    body = json.dumps({
        "text": text,
        "model_id": config.ELEVENLABS_MODEL_ID,
        "voice_settings": {"stability": 0.4, "similarity_boost": 0.8},
    }).encode("utf-8")
    return _request(
        f"{_API}/text-to-speech/{voice_id}?output_format=mp3_44100_128",
        method="POST",
        data=body,
        headers={"Content-Type": "application/json", "Accept": "audio/mpeg"},
        timeout=30,
    )
