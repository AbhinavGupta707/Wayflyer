"""Twilio outbound-call helper + TwiML builders.

The REST client is imported lazily so the API boots even when `twilio` isn't
installed. TwiML is built as plain strings (no SDK needed) so the webhook path
has zero hard dependency — only *placing* a call needs the twilio package.
"""
from __future__ import annotations
from xml.sax.saxutils import escape
from typing import Optional

from . import config


class TwilioError(RuntimeError):
    pass


def place_call(to_number: str, answer_url: str, status_url: Optional[str] = None) -> str:
    """Start an outbound call; Twilio fetches `answer_url` for TwiML. Returns SID."""
    if not config.twilio_configured():
        raise TwilioError("Twilio is not configured (set TWILIO_ACCOUNT_SID / "
                          "TWILIO_AUTH_TOKEN / TWILIO_NUMBER).")
    if not to_number:
        raise TwilioError("No destination number provided (to_number / DEMO_TO_NUMBER).")
    try:
        from twilio.rest import Client  # lazy
    except Exception as e:  # pragma: no cover
        raise TwilioError(f"twilio package not installed: {e}")

    client = Client(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN)
    kwargs = dict(to=to_number, from_=config.TWILIO_NUMBER, url=answer_url, method="POST")
    if status_url:
        kwargs.update(status_callback=status_url, status_callback_method="POST",
                      status_callback_event=["initiated", "answered", "completed"])
    try:
        call = client.calls.create(**kwargs)
    except Exception as e:
        raise TwilioError(f"Twilio call failed: {e}")
    return call.sid


# ----------------------------- TwiML builders -----------------------------

def _xml(inner: str) -> str:
    return f'<?xml version="1.0" encoding="UTF-8"?><Response>{inner}</Response>'


def twiml_offer(*, gather_action: str, play_url: Optional[str], say_text: str) -> str:
    """Greet + speak the offer (ElevenLabs <Play> if available, else <Say>),
    then gather a yes/no by speech or keypad (1 = yes, 2 = no)."""
    if play_url:
        speak = f'<Play>{escape(play_url)}</Play>'
    else:
        speak = f'<Say voice="Polly.Amy-Neural">{escape(say_text)}</Say>'
    gather = (
        f'<Gather input="speech dtmf" numDigits="1" timeout="6" '
        f'speechTimeout="auto" action="{escape(gather_action)}" method="POST" '
        f'hints="yes, yeah, sure, please, no, nope">'
        f'{speak}'
        f'</Gather>'
        # No input -> repeat once by redirecting back to the answer webhook.
        f'<Say voice="Polly.Amy-Neural">Sorry, I didn\'t catch that.</Say>'
        f'<Redirect method="POST">{escape(gather_action.replace("/gather", "/webhook"))}</Redirect>'
    )
    return _xml(gather)


def twiml_say(text: str, *, hangup: bool = True) -> str:
    inner = f'<Say voice="Polly.Amy-Neural">{escape(text)}</Say>'
    if hangup:
        inner += "<Hangup/>"
    return _xml(inner)
