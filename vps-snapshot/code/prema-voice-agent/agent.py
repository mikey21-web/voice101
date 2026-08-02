# ═══════════════════════════════════════════════════════════════
# PRIYA — HUMAN-LIKE REAL ESTATE VOICE AGENT
# Fixes: identity protection, Telugu naturalness, endpointing,
#        multilingual STT, transfer-to-sales tool, concurrent calls
# ═══════════════════════════════════════════════════════════════

import os
import json
import logging
from pathlib import Path
from dotenv import load_dotenv

from livekit import api as lk_api
from livekit.agents import (
    Agent,
    AgentSession,
    JobContext,
    RoomInputOptions,
    WorkerOptions,
    cli,
    function_tool,
)
from livekit.plugins import openai, sarvam, groq, google, cartesia

load_dotenv()

logger = logging.getLogger("priya-agent")
CONFIG_FILE = "config.json"
GRAMMAR_FILE = Path(__file__).parent / "grammar" / "prema_te_grammar.md"

# ───────────────────────────────────────────────────────────────
# PERSONA — role/identity only, kept short. Everything else (tone,
# conversation flow, objection handling, knowledge base, edge cases)
# lives in grammar/prema_te_grammar.md, loaded once below and appended
# at runtime -- see that file for the full behavior spec.
# ───────────────────────────────────────────────────────────────

HOT_PERSONA = (
    "You are Prema, a senior real estate advisory consultant representing Skyline Heights, "
    "a premium residential project in Kokapet, Hyderabad. You are calling a lead who enquired "
    "online. Your goal: qualify their buying intent, pitch Skyline Heights, and book a site visit. "
    "Always reply in native Telugu script (తెలుగు), never in romanized/Latin-letter Telugu -- "
    "the TTS reads romanized Telugu with English pronunciation and it sounds broken. "
    "If the caller replies in Hindi instead of Telugu, immediately call the switch_to_hindi tool, "
    "then continue the rest of the call in Hindi (Devanagari script, natural conversational Hindi, "
    "not formal/textbook Hindi). If the caller speaks English, just reply in English directly. "
    "If asked whether you're an AI, answer honestly and briefly, then continue the conversation. "
    "This is a live back-and-forth phone call, not a monologue: your very next sentence must "
    "directly react to what the caller just said -- answer their actual question or acknowledge "
    "their actual objection -- before you pivot to your own next point. Never fire off a pitch "
    "point that ignores what they just said."
)


def _load_grammar() -> str:
    try:
        return GRAMMAR_FILE.read_text(encoding="utf-8").strip()
    except OSError:
        return ""


IDENTITY_RULES = HOT_PERSONA + "\n\n" + _load_grammar()

# ───────────────────────────────────────────────────────────────
# CONFIG LOADER
# ───────────────────────────────────────────────────────────────

def _safe_float(value: str, default: float) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        logger.warning(f"[CONFIG] Invalid float value '{value}', using default {default}")
        return default


def load_agent_config() -> dict:
    """Reload on every call so dashboard changes take effect instantly."""
    config = {}
    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            config = json.load(f)

    def get(key, env_key, default=""):
        val = config.get(key)
        return val if val else os.getenv(env_key, default)

    return {
        "first_line":             get("first_line", "FIRST_LINE",
            "హలో అండి, నేను ప్రేమ మాట్లాడుతున్నాను, స్కైలైన్ హైట్స్ నుంచి. మీరు కొద్దిసేపటి క్రితం "
            "కోకాపేట్ ప్రాజెక్ట్ గురించి ఎంక్వైరీ పెట్టారు కదా అండి, అందుకే కాల్ చేశాను."),
        "agent_instructions":     get("agent_instructions", "AGENT_INSTRUCTIONS", ""),
        "llm_model":              get("llm_model", "LLM_MODEL", "gpt-4o-mini"),
        "tts_voice":              get("tts_voice", "TTS_VOICE", "anushka"),
        "tts_language":           get("tts_language", "TTS_LANGUAGE", "te-IN"),
        "stt_language":           get("stt_language", "STT_LANGUAGE", "te-IN"),
        "min_endpointing_delay":  _safe_float(get("min_endpointing_delay", "MIN_ENDPOINTING_DELAY", "0.8"), default=0.8),
        # .env in this deployment uses DEFAULT_TRANSFER_NUMBER; SALES_TRANSFER_NUMBER kept as an alias.
        "sales_transfer_number":  config.get("sales_transfer_number") or os.getenv("SALES_TRANSFER_NUMBER") or os.getenv("DEFAULT_TRANSFER_NUMBER", ""),
        "livekit_url":            get("livekit_url", "LIVEKIT_URL", ""),
        "livekit_api_key":        get("livekit_api_key", "LIVEKIT_API_KEY", ""),
        "livekit_api_secret":     get("livekit_api_secret", "LIVEKIT_API_SECRET", ""),
        "vobiz_sip_domain":       get("vobiz_sip_domain", "VOBIZ_SIP_DOMAIN", ""),
        "sip_trunk_id":           get("sip_trunk_id", "SIP_TRUNK_ID", ""),
    }


# ───────────────────────────────────────────────────────────────
# AGENT
# ───────────────────────────────────────────────────────────────

HINDI_CONFIRMATION = "ठीक है, अब हम हिंदी में बात करते हैं।"


class PriyaAgent(Agent):

    def __init__(self, config: dict, job_ctx: JobContext, language: str = "te", greet: bool = True):
        self._config = config
        self._job_ctx = job_ctx
        self._language = language
        self._greet = greet

        # Prepend immutable identity rules to whatever is in config.json
        full_instructions = IDENTITY_RULES.strip()
        extra = config.get("agent_instructions", "").strip()
        if extra:
            full_instructions += "\n\n" + extra

        kwargs = {"instructions": full_instructions}
        if language == "hi":
            # Relock STT + TTS to Hindi -- same engines, same Cartesia voice,
            # just a different language code (sonic-3 is multilingual per voice).
            kwargs["stt"] = sarvam.STT(language="hi-IN", model="saaras:v3", mode="codemix", flush_signal=True)
            kwargs["tts"] = cartesia.TTS(
                api_key=os.getenv("CARTESIA_API_KEY", ""),
                model="sonic-3",
                voice="cf061d8b-a752-4865-81a2-57570a6e0565",
                language="hi",
            )

        super().__init__(**kwargs)

    async def on_enter(self):
        if not self._greet:
            return
        # session.say() speaks the fixed line straight to TTS with no LLM round-trip --
        # generate_reply() here was waiting on an LLM call before saying a single word,
        # which is what caused the dead-air-then-speak gap at call start.
        await self.session.say(self._config["first_line"])

    # ── LANGUAGE SWITCH ──────────────────────────────────────────

    @function_tool
    async def switch_to_hindi(self) -> None:
        """
        Call this the moment the caller replies in Hindi instead of Telugu.
        Switches STT + TTS to Hindi for the rest of the call.
        """
        if self._language == "hi":
            return None
        # Speak the confirmation on the CURRENT (Telugu-voiced) session BEFORE
        # swapping -- update_agent() swaps silently, so if we swap first the
        # new agent says nothing and the call goes to dead air.
        await self.session.say(HINDI_CONFIRMATION)
        self.session.update_agent(PriyaAgent(config=self._config, job_ctx=self._job_ctx, language="hi", greet=False))
        return None

    # ── TRANSFER TO SALES TEAM ──────────────────────────────────

    @function_tool
    async def transfer_to_sales(self) -> str:
        """
        Transfer this call to the human sales specialist team.
        Call this tool when the lead is interested and wants more details
        or to speak with someone directly.
        """
        transfer_number = self._config.get("sales_transfer_number", "").strip()
        sip_domain = self._config.get("vobiz_sip_domain", "").strip()

        if not transfer_number:
            logger.warning("[TRANSFER] sales_transfer_number not set in config — skipping transfer.")
            return "transfer_unavailable"

        try:
            lk = lk_api.LiveKitAPI(
                url=self._config["livekit_url"] or os.getenv("LIVEKIT_URL", ""),
                api_key=self._config["livekit_api_key"] or os.getenv("LIVEKIT_API_KEY", ""),
                api_secret=self._config["livekit_api_secret"] or os.getenv("LIVEKIT_API_SECRET", ""),
            )

            # Find the caller (any remote participant that isn't the agent)
            room = self._job_ctx.room
            caller_identity = None
            for identity, participant in room.remote_participants.items():
                caller_identity = identity
                break  # take the first one — should only be one caller per room

            if not caller_identity:
                await lk.aclose()
                logger.error("[TRANSFER] No caller participant found in room.")
                return "transfer_failed"

            transfer_uri = (
                f"sip:{transfer_number}@{sip_domain}"
                if sip_domain
                else f"tel:{transfer_number}"
            )

            await lk.sip.transfer_sip_participant(
                lk_api.TransferSIPParticipantRequest(
                    room_name=room.name,
                    participant_identity=caller_identity,
                    transfer_to=transfer_uri,
                    play_dialtone=True,
                )
            )
            await lk.aclose()
            logger.info(f"[TRANSFER] Transferred {caller_identity} → {transfer_uri}")
            return "transfer_success"

        except Exception as e:
            logger.error(f"[TRANSFER] Failed: {e}")
            return f"transfer_failed: {e}"


# ───────────────────────────────────────────────────────────────
# ENTRYPOINT — one instance per call, fully isolated
# ───────────────────────────────────────────────────────────────

async def entrypoint(ctx: JobContext):

    # Reload config fresh for every call (picks up dashboard changes)
    config = load_agent_config()

    await ctx.connect()

    # ── OUTBOUND DIAL-OUT ────────────────────────────────────────
    # make_call.py dispatches with metadata={"phone_number": "+91..."}.
    # Inbound calls (via the Vobiz trunk + LiveKit dispatch rule) have
    # no metadata — the caller is already a participant in the room.
    phone_number = None
    if ctx.job.metadata:
        try:
            phone_number = json.loads(ctx.job.metadata).get("phone_number")
        except (json.JSONDecodeError, AttributeError, TypeError):
            logger.warning("[OUTBOUND] Job metadata present but not valid JSON — treating as inbound call.")

    if phone_number:
        trunk_id = config["sip_trunk_id"]
        if not trunk_id:
            logger.error("[OUTBOUND] SIP_TRUNK_ID not configured — cannot dial out. Aborting job.")
            return

        logger.info(f"[OUTBOUND] Dialing {phone_number} via trunk {trunk_id}")
        try:
            await ctx.api.sip.create_sip_participant(
                lk_api.CreateSIPParticipantRequest(
                    room_name=ctx.room.name,
                    sip_trunk_id=trunk_id,
                    sip_call_to=phone_number,
                    participant_identity=f"sip_{phone_number.lstrip('+')}",
                    wait_until_answered=True,
                )
            )
            logger.info(f"[OUTBOUND] {phone_number} answered — starting conversation.")
        except Exception as e:
            logger.error(f"[OUTBOUND] Failed to reach {phone_number}: {e}")
            return

    agent = PriyaAgent(config=config, job_ctx=ctx)

    session = AgentSession(

        # STT — Sarvam saaras:v3 handles Tenglish code-switching natively
        stt=sarvam.STT(
            language=config["stt_language"],
            model="saaras:v3",
            mode="codemix",
            flush_signal=True,
        ),

        # LLM — Gemini, using the fresh API key. (Groq was tried but the configured GROQ_API_KEY
        # is being rejected with 401 Invalid API Key -- switch back to groq.LLM once a working
        # Groq key is confirmed, since it has no daily quota wall and is faster.)
        llm=google.LLM(
            model="gemini-flash-latest",
            api_key=os.getenv("GOOGLE_API_KEY", ""),
            temperature=0.3,
            max_output_tokens=200,
        ),

        # TTS — Sarvam bulbul:v2 "anushka" is the most natural Telugu female voice
        # TTS — Cartesia (Sarvam's TTS response format changed server-side and
        # broke the plugin's WAV decoder; Cartesia is proven working tonight)
        tts=cartesia.TTS(
            api_key=os.getenv("CARTESIA_API_KEY", ""),
            model="sonic-3",
            voice="cf061d8b-a752-4865-81a2-57570a6e0565",  # Ramya - Graceful Host (Telugu)
            language="te",
        ),

        # Turn detection — 0.8s gives a human-like pause before responding
        turn_detection="stt",
        min_endpointing_delay=config["min_endpointing_delay"],
        allow_interruptions=True,
        # A short backchannel ("ఆ చెప్పండి") was cutting Prema off mid-sentence because the
        # default (0.5s speech / 0 words) counts almost any caller sound as a real interruption.
        # Require a bit more speech before treating it as one -- real objections/questions are
        # rarely just 1-2 words anyway.
        min_interruption_duration=0.8,
        min_interruption_words=2,
    )

    # ── LATENCY DIAGNOSTICS — logs how long each stage (EOU/LLM TTFT/TTS TTFB) took ──
    @session.on("metrics_collected")
    def _on_metrics(ev):
        m = ev.metrics
        logger.info(f"[METRICS] {type(m).__name__}: {m}")

    await session.start(
        room=ctx.room,
        agent=agent,
        room_input_options=RoomInputOptions(
            close_on_disconnect=False,
        ),
    )


# ───────────────────────────────────────────────────────────────
# WORKER — num_idle_processes pre-spawns workers so concurrent
#           calls are answered instantly with no cold-start delay
# ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            agent_name="human-voice-agent",
            num_idle_processes=5,   # handles up to 5 simultaneous calls without delay
        )
    )
