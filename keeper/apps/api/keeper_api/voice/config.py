"""Voice (WS6) configuration — read from the environment / .env.

Nothing here is required for the API to boot: every integration degrades
gracefully when its keys are absent (the browser widget falls back to a text
transcript + Yes/No buttons; the phone path returns a clear "not configured"
error instead of crashing). See keeper/apps/api/keeper_api/voice/.env.example.
"""
from __future__ import annotations
import os

try:  # python-dotenv is a core dep, but stay import-safe regardless.
    from dotenv import load_dotenv

    load_dotenv()
except Exception:  # pragma: no cover
    pass


def _get(name: str, default: str = "") -> str:
    return (os.getenv(name) or default).strip()


# --- ElevenLabs (browser widget + TTS for the phone clip) ---
ELEVENLABS_API_KEY = _get("ELEVENLABS_API_KEY")
ELEVENLABS_AGENT_ID = _get("ELEVENLABS_AGENT_ID")          # Conversational-AI agent
ELEVENLABS_VOICE_ID = _get("ELEVENLABS_VOICE_ID", "EXAVITQu4vr4xnSDxMaL")  # 'Sarah' default
ELEVENLABS_MODEL_ID = _get("ELEVENLABS_MODEL_ID", "eleven_turbo_v2_5")

# --- Twilio (real outbound call to a phone on stage) ---
TWILIO_ACCOUNT_SID = _get("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = _get("TWILIO_AUTH_TOKEN")
TWILIO_NUMBER = _get("TWILIO_NUMBER")                      # the from-number you own
DEMO_TO_NUMBER = _get("DEMO_TO_NUMBER")                    # default stage phone (optional)

# --- URLs ---
# Public https base that Twilio can reach (an ngrok tunnel in the demo).
PUBLIC_BASE_URL = _get("PUBLIC_BASE_URL").rstrip("/")
# Where this API is reachable from itself, for the in-process /respond hop.
SELF_BASE_URL = _get("SELF_BASE_URL", "http://127.0.0.1:8000").rstrip("/")


def elevenlabs_configured() -> bool:
    return bool(ELEVENLABS_API_KEY)


def elevenlabs_widget_configured() -> bool:
    return bool(ELEVENLABS_AGENT_ID)


def twilio_configured() -> bool:
    return bool(TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN and TWILIO_NUMBER)


def status() -> dict:
    """A small, secret-free snapshot for /api/voice/health and the UI."""
    return {
        "elevenlabs_tts": elevenlabs_configured(),
        "elevenlabs_widget": elevenlabs_widget_configured(),
        "elevenlabs_agent_id": ELEVENLABS_AGENT_ID or None,
        "twilio": twilio_configured(),
        "twilio_number": TWILIO_NUMBER or None,
        "public_base_url": PUBLIC_BASE_URL or None,
        "webhook_reachable": bool(PUBLIC_BASE_URL),
    }
