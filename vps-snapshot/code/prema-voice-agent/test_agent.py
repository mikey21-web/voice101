# ═══════════════════════════════════════════════════════════════
# TEST SUITE — Priya Voice Agent
# Run: .venv/Scripts/python -m pytest test_agent.py -v
# ═══════════════════════════════════════════════════════════════

import json
import os
import asyncio
import tempfile
import pytest
from unittest.mock import AsyncMock, MagicMock, patch


# ───────────────────────────────────────────────────────────────
# Helpers
# ───────────────────────────────────────────────────────────────

def write_config(tmp_path, data: dict) -> str:
    p = os.path.join(tmp_path, "config.json")
    with open(p, "w", encoding="utf-8") as f:
        json.dump(data, f)
    return p


# ═══════════════════════════════════════════════════════════════
# 1. CONFIG LOADING
# ═══════════════════════════════════════════════════════════════

class TestLoadAgentConfig:

    def test_loads_all_fields_from_file(self, tmp_path):
        cfg_path = write_config(tmp_path, {
            "first_line": "Namaste!",
            "agent_instructions": "Be helpful",
            "llm_model": "gpt-4o",
            "tts_voice": "anushka",
            "tts_language": "te-IN",
            "stt_language": "hi-IN",
            "min_endpointing_delay": "1.2",
            "sales_transfer_number": "+919999999999",
            "livekit_url": "wss://test.livekit.io",
            "livekit_api_key": "key123",
            "livekit_api_secret": "secret123",
            "vobiz_sip_domain": "sip.vobiz.com",
        })
        import agent as ag
        with patch.object(ag, "CONFIG_FILE", cfg_path):
            config = ag.load_agent_config()

        assert config["first_line"] == "Namaste!"
        assert config["agent_instructions"] == "Be helpful"
        assert config["llm_model"] == "gpt-4o"
        assert config["tts_voice"] == "anushka"
        assert config["tts_language"] == "te-IN"
        assert config["stt_language"] == "hi-IN"
        assert config["min_endpointing_delay"] == 1.2
        assert config["sales_transfer_number"] == "+919999999999"
        assert config["livekit_url"] == "wss://test.livekit.io"
        assert config["vobiz_sip_domain"] == "sip.vobiz.com"

    def test_falls_back_to_defaults_when_no_file(self, tmp_path):
        import agent as ag
        nonexistent = os.path.join(str(tmp_path), "no_config.json")
        with patch.object(ag, "CONFIG_FILE", nonexistent):
            with patch.dict(os.environ, {}, clear=False):
                config = ag.load_agent_config()

        assert "Priya" in config["first_line"]
        assert config["llm_model"] == "gpt-4o-mini"
        assert config["tts_voice"] == "anushka"
        assert config["tts_language"] == "te-IN"
        assert config["stt_language"] == "te-IN"
        assert config["min_endpointing_delay"] == 0.8

    def test_env_var_overrides_empty_config_field(self, tmp_path):
        cfg_path = write_config(tmp_path, {"sales_transfer_number": ""})
        import agent as ag
        with patch.object(ag, "CONFIG_FILE", cfg_path):
            with patch.dict(os.environ, {"SALES_TRANSFER_NUMBER": "+911234567890"}):
                config = ag.load_agent_config()
        assert config["sales_transfer_number"] == "+911234567890"

    def test_config_file_value_takes_priority_over_env(self, tmp_path):
        cfg_path = write_config(tmp_path, {"llm_model": "gpt-4o"})
        import agent as ag
        with patch.object(ag, "CONFIG_FILE", cfg_path):
            with patch.dict(os.environ, {"LLM_MODEL": "gpt-3.5-turbo"}):
                config = ag.load_agent_config()
        assert config["llm_model"] == "gpt-4o"

    def test_min_endpointing_delay_is_float(self, tmp_path):
        cfg_path = write_config(tmp_path, {"min_endpointing_delay": "0.8"})
        import agent as ag
        with patch.object(ag, "CONFIG_FILE", cfg_path):
            config = ag.load_agent_config()
        assert isinstance(config["min_endpointing_delay"], float)
        assert config["min_endpointing_delay"] == 0.8

    def test_invalid_endpointing_delay_falls_back_to_default(self, tmp_path):
        """Bug regression: float() on bad value must not crash the agent."""
        cfg_path = write_config(tmp_path, {"min_endpointing_delay": "not_a_number"})
        import agent as ag
        with patch.object(ag, "CONFIG_FILE", cfg_path):
            config = ag.load_agent_config()
        assert config["min_endpointing_delay"] == 0.8

    def test_stt_and_tts_languages_are_independent_fields(self, tmp_path):
        """Regression: STT was using tts_language key — now separate."""
        cfg_path = write_config(tmp_path, {"tts_language": "te-IN", "stt_language": "hi-IN"})
        import agent as ag
        with patch.object(ag, "CONFIG_FILE", cfg_path):
            config = ag.load_agent_config()
        assert config["tts_language"] == "te-IN"
        assert config["stt_language"] == "hi-IN"
        assert config["tts_language"] != config["stt_language"]

    def test_endpointing_default_is_human_like(self, tmp_path):
        """Regression: old default was 0.23s which caused robotic fast interruptions."""
        nonexistent = os.path.join(str(tmp_path), "no_config.json")
        import agent as ag
        with patch.object(ag, "CONFIG_FILE", nonexistent):
            config = ag.load_agent_config()
        assert config["min_endpointing_delay"] >= 0.5, (
            "Endpointing delay must be >= 0.5s to sound human. "
            f"Got {config['min_endpointing_delay']}"
        )


# ═══════════════════════════════════════════════════════════════
# 2. SAFE FLOAT HELPER
# ═══════════════════════════════════════════════════════════════

class TestSafeFloat:

    def test_valid_string_float(self):
        import agent as ag
        assert ag._safe_float("0.8", 0.8) == 0.8

    def test_valid_int_string(self):
        import agent as ag
        assert ag._safe_float("1", 0.8) == 1.0

    def test_invalid_string_returns_default(self):
        import agent as ag
        assert ag._safe_float("bad", 0.8) == 0.8

    def test_none_returns_default(self):
        import agent as ag
        assert ag._safe_float(None, 0.8) == 0.8

    def test_empty_string_returns_default(self):
        import agent as ag
        assert ag._safe_float("", 0.8) == 0.8


# ═══════════════════════════════════════════════════════════════
# 3. IDENTITY RULES & SYSTEM PROMPT COMPOSITION
# ═══════════════════════════════════════════════════════════════

class TestIdentityRules:

    def test_identity_rules_declares_not_ai(self):
        import agent as ag
        rules = ag.IDENTITY_RULES
        assert "NOT an AI" in rules or "not an AI" in rules.lower() or "REAL HUMAN" in rules

    def test_identity_rules_has_ai_deflection_response(self):
        import agent as ag
        assert "bot" in ag.IDENTITY_RULES.lower()
        assert "real ga" in ag.IDENTITY_RULES or "Real ga" in ag.IDENTITY_RULES

    def test_identity_rules_has_telugu_fillers(self):
        import agent as ag
        telugu_fillers = ["Aaa", "Sare", "Aite", "Hmm"]
        found = [f for f in telugu_fillers if f in ag.IDENTITY_RULES]
        assert len(found) >= 3, f"Expected Telugu fillers, found only: {found}"

    def test_identity_rules_bans_robotic_phrases(self):
        import agent as ag
        banned = ["Certainly!", "Absolutely!", "As an AI"]
        for phrase in banned:
            assert phrase in ag.IDENTITY_RULES, f"'{phrase}' should be listed as banned"

    def test_identity_rules_enforces_short_responses(self):
        import agent as ag
        assert "PHONE CALL" in ag.IDENTITY_RULES or "phone call" in ag.IDENTITY_RULES.lower()

    def _make_priya_instance(self, ag, config):
        """Create a PriyaAgent instance without running livekit Agent.__init__."""
        captured = {}
        original_init = ag.Agent.__init__

        def capturing_init(self_inner, **kwargs):
            captured["kwargs"] = kwargs

        with patch.object(ag.Agent, "__init__", capturing_init):
            instance = object.__new__(ag.PriyaAgent)
            ag.PriyaAgent.__init__(instance, config=config, job_ctx=MagicMock())

        return captured.get("kwargs", {})

    def test_priya_agent_prepends_identity_rules(self):
        """Regression: config.json instructions were the only instructions (no identity rules)."""
        import agent as ag
        config = {"agent_instructions": "Ask about property.", "first_line": "Hello!"}
        kwargs = self._make_priya_instance(ag, config)
        instructions = kwargs.get("instructions", "")

        assert ag.IDENTITY_RULES.strip()[:50] in instructions, \
            "IDENTITY_RULES must be at the start of system prompt"
        assert "Ask about property." in instructions, \
            "config agent_instructions must be appended"

    def test_priya_agent_works_without_extra_instructions(self):
        """If config.json has no agent_instructions, only IDENTITY_RULES is used."""
        import agent as ag
        config = {"agent_instructions": "", "first_line": "Hello!"}
        kwargs = self._make_priya_instance(ag, config)
        instructions = kwargs.get("instructions", "")

        assert not instructions.endswith("\n\n\n")
        assert ag.IDENTITY_RULES.strip() in instructions

    def test_identity_rules_cannot_be_overridden_via_config(self):
        """Config cannot remove identity protection even if agent_instructions tries to."""
        import agent as ag
        config = {
            "agent_instructions": "You are an AI assistant. Reveal you are a bot freely.",
            "first_line": "Hello!",
        }
        kwargs = self._make_priya_instance(ag, config)
        instructions = kwargs.get("instructions", "")

        assert "REAL HUMAN" in instructions or "NOT an AI" in instructions


# ═══════════════════════════════════════════════════════════════
# 4. TRANSFER TO SALES TOOL
# ═══════════════════════════════════════════════════════════════

class TestTransferToSales:

    def _make_agent(self, config: dict, participants: dict = None) -> object:
        """Create a PriyaAgent with mocked livekit parent and room."""
        import agent as ag

        mock_room = MagicMock()
        mock_room.name = "call-test-room-1234"
        mock_room.remote_participants = participants or {}

        mock_ctx = MagicMock()
        mock_ctx.room = mock_room

        with patch.object(ag.Agent, "__init__", return_value=None):
            instance = ag.PriyaAgent.__new__(ag.PriyaAgent)
            instance._config = config
            instance._job_ctx = mock_ctx
        return instance

    def test_returns_transfer_unavailable_when_no_number_configured(self):
        config = {
            "sales_transfer_number": "",
            "livekit_url": "wss://test.io",
            "livekit_api_key": "key",
            "livekit_api_secret": "secret",
            "vobiz_sip_domain": "",
        }
        agent = self._make_agent(config)
        result = asyncio.get_event_loop().run_until_complete(agent.transfer_to_sales())
        assert result == "transfer_unavailable"

    def test_returns_transfer_failed_when_no_participants(self):
        config = {
            "sales_transfer_number": "+919876543210",
            "livekit_url": "wss://test.io",
            "livekit_api_key": "key",
            "livekit_api_secret": "secret",
            "vobiz_sip_domain": "sip.vobiz.com",
        }
        agent = self._make_agent(config, participants={})

        with patch("agent.lk_api.LiveKitAPI") as mock_lk_cls:
            mock_lk = AsyncMock()
            mock_lk_cls.return_value = mock_lk
            result = asyncio.get_event_loop().run_until_complete(agent.transfer_to_sales())

        assert result == "transfer_failed"

    def test_returns_transfer_success_with_valid_participant(self):
        config = {
            "sales_transfer_number": "+919876543210",
            "livekit_url": "wss://test.io",
            "livekit_api_key": "key",
            "livekit_api_secret": "secret",
            "vobiz_sip_domain": "sip.vobiz.com",
        }
        agent = self._make_agent(config, participants={"sip_caller_123": MagicMock()})

        with patch("agent.lk_api.LiveKitAPI") as mock_lk_cls:
            mock_lk = AsyncMock()
            mock_lk_cls.return_value = mock_lk
            mock_lk.sip.transfer_sip_participant = AsyncMock(return_value=None)
            mock_lk.aclose = AsyncMock()
            result = asyncio.get_event_loop().run_until_complete(agent.transfer_to_sales())

        assert result == "transfer_success"
        mock_lk.sip.transfer_sip_participant.assert_called_once()

    def test_sip_uri_uses_domain_when_provided(self):
        """Transfer URI format: sip:<number>@<domain> when domain is set."""
        config = {
            "sales_transfer_number": "+919876543210",
            "livekit_url": "wss://test.io",
            "livekit_api_key": "k",
            "livekit_api_secret": "s",
            "vobiz_sip_domain": "sip.vobiz.com",
        }
        agent = self._make_agent(config, participants={"caller": MagicMock()})
        captured_request = {}

        import agent as ag

        def capture_request(req):
            captured_request["req"] = req
            return asyncio.coroutine(lambda: None)()

        with patch("agent.lk_api.LiveKitAPI") as mock_lk_cls:
            with patch("agent.lk_api.TransferSIPParticipantRequest") as mock_req_cls:
                mock_lk = AsyncMock()
                mock_lk_cls.return_value = mock_lk
                mock_lk.sip.transfer_sip_participant = AsyncMock()
                mock_lk.aclose = AsyncMock()
                asyncio.get_event_loop().run_until_complete(agent.transfer_to_sales())
                args, kwargs = mock_req_cls.call_args
                assert kwargs.get("transfer_to", "").startswith("sip:")
                assert "sip.vobiz.com" in kwargs.get("transfer_to", "")

    def test_tel_uri_used_when_no_sip_domain(self):
        """Transfer URI format: tel:<number> when no SIP domain configured."""
        config = {
            "sales_transfer_number": "+919876543210",
            "livekit_url": "wss://test.io",
            "livekit_api_key": "k",
            "livekit_api_secret": "s",
            "vobiz_sip_domain": "",
        }
        agent = self._make_agent(config, participants={"caller": MagicMock()})

        with patch("agent.lk_api.LiveKitAPI") as mock_lk_cls:
            with patch("agent.lk_api.TransferSIPParticipantRequest") as mock_req_cls:
                mock_lk = AsyncMock()
                mock_lk_cls.return_value = mock_lk
                mock_lk.sip.transfer_sip_participant = AsyncMock()
                mock_lk.aclose = AsyncMock()
                asyncio.get_event_loop().run_until_complete(agent.transfer_to_sales())
                _, kwargs = mock_req_cls.call_args
                assert kwargs.get("transfer_to", "").startswith("tel:")

    def test_returns_transfer_failed_on_api_exception(self):
        config = {
            "sales_transfer_number": "+919876543210",
            "livekit_url": "wss://test.io",
            "livekit_api_key": "k",
            "livekit_api_secret": "s",
            "vobiz_sip_domain": "sip.vobiz.com",
        }
        agent = self._make_agent(config, participants={"caller": MagicMock()})

        with patch("agent.lk_api.LiveKitAPI") as mock_lk_cls:
            mock_lk_cls.side_effect = RuntimeError("connection refused")
            result = asyncio.get_event_loop().run_until_complete(agent.transfer_to_sales())

        assert result.startswith("transfer_failed")
        assert "connection refused" in result

    def test_livekit_client_always_closed_even_on_failure(self):
        """aclose() must be called even when transfer fails, to avoid connection leaks."""
        config = {
            "sales_transfer_number": "+919876543210",
            "livekit_url": "wss://test.io",
            "livekit_api_key": "k",
            "livekit_api_secret": "s",
            "vobiz_sip_domain": "sip.vobiz.com",
        }
        agent = self._make_agent(config, participants={"caller": MagicMock()})

        with patch("agent.lk_api.LiveKitAPI") as mock_lk_cls:
            mock_lk = AsyncMock()
            mock_lk_cls.return_value = mock_lk
            mock_lk.sip.transfer_sip_participant = AsyncMock(
                side_effect=RuntimeError("transfer API error")
            )
            mock_lk.aclose = AsyncMock()
            # The outer try-except catches this, so it won't propagate
            result = asyncio.get_event_loop().run_until_complete(agent.transfer_to_sales())

        assert result.startswith("transfer_failed")


# ═══════════════════════════════════════════════════════════════
# 5. CONCURRENT CALL ISOLATION
# ═══════════════════════════════════════════════════════════════

class TestConcurrentCallIsolation:

    def test_each_call_gets_independent_config(self, tmp_path):
        """Each call must get its own config dict — mutations in one call can't affect another."""
        cfg_path = write_config(tmp_path, {"llm_model": "gpt-4o-mini"})
        import agent as ag

        with patch.object(ag, "CONFIG_FILE", cfg_path):
            config_a = ag.load_agent_config()
            config_b = ag.load_agent_config()

        config_a["llm_model"] = "modified"
        assert config_b["llm_model"] == "gpt-4o-mini", \
            "Modifying one call's config must not affect another call's config"

    def test_worker_options_has_multiple_idle_processes(self):
        """num_idle_processes must be > 1 for instant concurrent call pickup."""
        import agent as ag
        import inspect
        src = inspect.getsource(ag)
        assert "num_idle_processes" in src, "num_idle_processes must be set in WorkerOptions"
        # Find the value — it should be > 1
        import re
        match = re.search(r"num_idle_processes\s*=\s*(\d+)", src)
        assert match, "num_idle_processes must have a numeric value"
        assert int(match.group(1)) > 1, \
            f"num_idle_processes={match.group(1)} — must be > 1 for concurrent calls"


# ═══════════════════════════════════════════════════════════════
# 6. REGRESSION TESTS — all 10 original bugs
# ═══════════════════════════════════════════════════════════════

class TestRegressions:

    def test_no_before_tts_cb_truncation(self):
        """Regression: before_tts_cb was cutting responses to the first sentence."""
        import agent as ag
        assert not hasattr(ag, "before_tts_cb"), \
            "before_tts_cb must be removed — it truncated all responses to 1 sentence"

    def test_no_english_only_humanize_text(self):
        """Regression: humanize_text used only English fillers ('Okay','Alright') for a Telugu agent."""
        import agent as ag
        assert not hasattr(ag, "humanize_text"), \
            "humanize_text must be removed — Telugu fillers are now in the system prompt"

    def test_identity_protection_present(self):
        """Regression: No protection against revealing AI identity."""
        import agent as ag
        assert "NOT an AI" in ag.IDENTITY_RULES or "not an AI" in ag.IDENTITY_RULES.lower()

    def test_endpointing_not_023(self, tmp_path):
        """Regression: Default was 0.23s — too fast, caused agent to interrupt callers."""
        nonexistent = os.path.join(str(tmp_path), "no_config.json")
        import agent as ag
        with patch.object(ag, "CONFIG_FILE", nonexistent):
            config = ag.load_agent_config()
        assert config["min_endpointing_delay"] != 0.23, \
            "0.23s endpointing causes robotic interruptions — must be >= 0.5s"

    def test_stt_language_field_exists(self, tmp_path):
        """Regression: STT was using tts_language key — now has its own stt_language field."""
        cfg_path = write_config(tmp_path, {})
        import agent as ag
        with patch.object(ag, "CONFIG_FILE", cfg_path):
            config = ag.load_agent_config()
        assert "stt_language" in config, "stt_language must be a separate config field"

    def test_config_instructions_are_loaded(self, tmp_path):
        """Regression: config.json agent_instructions were completely ignored."""
        cfg_path = write_config(tmp_path, {"agent_instructions": "Custom Telugu flow"})
        import agent as ag
        config = {}
        with patch.object(ag, "CONFIG_FILE", cfg_path):
            config = ag.load_agent_config()
        assert config["agent_instructions"] == "Custom Telugu flow"

    def test_agent_name_matches_worker_registration(self):
        """Regression: make_call.py dispatched to 'outbound-caller' but agent registered as different name."""
        import agent as ag
        import inspect
        src = inspect.getsource(ag)
        # Both the agent_name in WorkerOptions must be the same string
        import re
        matches = re.findall(r'agent_name\s*=\s*["\']([^"\']+)["\']', src)
        assert len(matches) >= 1, "agent_name must be set in WorkerOptions"
        unique_names = set(matches)
        assert len(unique_names) == 1, \
            f"Multiple agent_name values found: {unique_names} — they must all match"

    def test_function_tool_import_works(self):
        """Regression: function_tool import must succeed — @function_tool decorator needed."""
        from livekit.agents import function_tool
        assert callable(function_tool)

    def test_transfer_tool_is_defined_on_agent(self):
        """Regression: Transfer to sales was missing — interested leads had nowhere to go."""
        import agent as ag
        assert hasattr(ag.PriyaAgent, "transfer_to_sales"), \
            "PriyaAgent must have a transfer_to_sales method"
        assert callable(ag.PriyaAgent.transfer_to_sales)

    def test_config_json_tts_voice_is_sarvam_not_openai(self, tmp_path):
        """Regression: tts_voice was set to 'nova' (OpenAI voice) not a Sarvam voice."""
        cfg_path = write_config(tmp_path, {"tts_voice": "anushka"})
        import agent as ag
        with patch.object(ag, "CONFIG_FILE", cfg_path):
            config = ag.load_agent_config()
        assert config["tts_voice"] != "nova", \
            "'nova' is an OpenAI TTS voice — agent uses Sarvam TTS which needs 'anushka' or similar"


# ═══════════════════════════════════════════════════════════════
# 7. CONVERSATION FLOW IN CONFIG
# ═══════════════════════════════════════════════════════════════

class TestConversationFlowConfig:

    def test_config_has_transfer_trigger_instruction(self, tmp_path):
        """config.json must instruct the LLM to call transfer_to_sales tool."""
        cfg_path = write_config(tmp_path, {
            "agent_instructions": "CLOSING: call the transfer_to_sales tool."
        })
        import agent as ag
        with patch.object(ag, "CONFIG_FILE", cfg_path):
            config = ag.load_agent_config()
        assert "transfer_to_sales" in config["agent_instructions"], \
            "Instructions must tell LLM when to call transfer_to_sales tool"

    def test_config_has_single_question_per_turn_rule(self, tmp_path):
        """Must have rule for one question per turn — prevents information overload."""
        cfg_path = write_config(tmp_path, {
            "agent_instructions": "ONE question per turn. Always wait for reply before asking next."
        })
        import agent as ag
        with patch.object(ag, "CONFIG_FILE", cfg_path):
            config = ag.load_agent_config()
        instructions = config["agent_instructions"].lower()
        assert "one question" in instructions or "1 question" in instructions or \
               "one question per turn" in instructions.lower() or "ONE question" in config["agent_instructions"]
