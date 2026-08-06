from __future__ import annotations

import httpx
from app.config import Settings


class KhojClient:
    def __init__(self, settings: Settings):
        self.base = settings.khoj_api_url.rstrip("/")
        self.api_key = settings.khoj_api_key
        self.timeout = settings.khoj_request_timeout
        headers: dict[str, str] = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        self.client = httpx.AsyncClient(timeout=httpx.Timeout(self.timeout), headers=headers)

    async def close(self):
        await self.client.aclose()

    async def health(self) -> bool:
        try:
            r = await self.client.get(f"{self.base}/api/health", timeout=5)
            return r.is_success
        except Exception:
            return False

    async def save_memory(self, raw: str) -> dict | None:
        try:
            r = await self.client.post(f"{self.base}/api/memories", json={"raw": raw})
            if r.is_success:
                return r.json()
            return None
        except Exception:
            return None

    async def ingest_text(self, content: str, source: str = "agent-service") -> bool:
        try:
            r = await self.client.post(
                f"{self.base}/api/content",
                json={"content": content, "type": "markdown", "source": source},
            )
            return r.is_success
        except Exception:
            return False

    async def search(self, query: str, limit: int = 3) -> str:
        """Query Khoj and return a plain-text context string, empty string on failure."""
        if not query:
            return ""
        try:
            r = await self.client.post(
                f"{self.base}/api/search",
                json={"q": query, "n": limit},
            )
            if not r.is_success:
                return ""
            results = r.json()
            if isinstance(results, list):
                return "\n\n".join(
                    item.get("entry", item.get("corpus_id", "")) if isinstance(item, dict) else str(item)
                    for item in results[:limit]
                ).strip()
            return ""
        except Exception:
            return ""
