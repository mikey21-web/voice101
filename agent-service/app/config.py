from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="", extra="ignore")

    backend_api_url: str = "http://localhost:3001"
    agent_service_jwt: str = ""
    agent_inbound_key: str = ""
    deepseek_api_key: str = ""
    deepseek_base_url: str = "https://api.deepseek.com/v1"
    openai_api_key: str = ""
    openai_base_url: str | None = None
    agent_model: str = "deepseek-v4-flash"
    agent_max_tokens: int = 16384
    agent_reasoning_effort: str = "medium"
    redis_url: str | None = None
    max_agent_steps: int = 12
    request_timeout_seconds: float = 20.0
    port: int = 8000

    # Khoj knowledge base
    khoj_api_url: str = "http://localhost:42111"
    khoj_api_key: str = ""
    khoj_request_timeout: float = 10.0

    # Langfuse tracing (self-hosted, env-gated; no-op if unset)
    langfuse_host: str | None = None
    langfuse_public_key: str | None = None
    langfuse_secret_key: str | None = None


def resolve_llm_credentials(settings: "Settings") -> tuple[str, str | None, str, bool]:
    """Single place all three ChatOpenAI call sites (graph.py, lead_agent.py,
    supervisor_graph.py) get their (api_key, base_url, model, supports_reasoning_effort)
    from. OPENAI_API_KEY takes priority over DEEPSEEK_API_KEY so a DeepSeek balance
    outage (as already hit once on the workflow generator) doesn't need a per-caller
    patch — falling back to gpt-4o-mini when AGENT_MODEL is still a deepseek-* default
    that OpenAI won't recognize.
    """
    if settings.openai_api_key:
        model = settings.agent_model if not settings.agent_model.startswith("deepseek") else "gpt-4o-mini"
        supports_reasoning_effort = model.startswith(("o1", "o3", "o4", "gpt-5"))
        return settings.openai_api_key, settings.openai_base_url, model, supports_reasoning_effort
    supports_reasoning_effort = settings.agent_model.startswith(("deepseek", "o1", "o3", "o4", "gpt-5"))
    return settings.deepseek_api_key, settings.deepseek_base_url, settings.agent_model, supports_reasoning_effort
