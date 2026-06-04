"""WS6 — Voice. The fit-concierge that calls/answers and speaks the already-decided
offer (ElevenLabs Conversational-AI widget + real Twilio Programmable Voice).

See keeper/tasks/TASK_WS6_voice.md and ./README.md.

`router` is included by keeper_api.main. Importing it never hard-fails on missing
telephony deps — every integration degrades gracefully.
"""
from .routes import router  # noqa: F401
from .offer import VoiceOffer, build_offer  # noqa: F401

__all__ = ["router", "VoiceOffer", "build_offer"]
