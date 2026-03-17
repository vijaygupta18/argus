import json
import logging

import litellm

from app.config import settings

logger = logging.getLogger(__name__)


class AIService:
    def __init__(self):
        self.model = settings.ai_model
        self.fast_model = settings.ai_fast_model or settings.ai_model
        self.api_key = settings.ai_api_key
        self.api_base = settings.ai_api_base or None
        self.provider = settings.ai_provider
        self.max_tokens = settings.ai_max_tokens
        self.temperature = settings.ai_temperature

    def _get_model_name(self, fast: bool = False) -> str:
        """Get the fully qualified model name for litellm."""
        model = self.fast_model if fast else self.model
        if self.provider == "claude" and not model.startswith("anthropic/"):
            return f"anthropic/{model}"
        if self.provider == "openai" and not model.startswith("openai/"):
            return f"openai/{model}"
        return model

    def _completion_kwargs(self, fast: bool = False) -> dict:
        """Build common kwargs for litellm.acompletion."""
        kwargs = {
            "model": self._get_model_name(fast=fast),
            "api_key": self.api_key,
        }
        if self.api_base:
            kwargs["api_base"] = self.api_base
        return kwargs

    @staticmethod
    def _extract_json(content: str) -> dict:
        """Extract JSON from model response, handling thinking tokens and code blocks."""
        content = content.strip()
        # Try direct parse first
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            pass
        # Try extracting from code blocks
        if "```" in content:
            for block in content.split("```"):
                block = block.strip().removeprefix("json").strip()
                try:
                    return json.loads(block)
                except json.JSONDecodeError:
                    continue
        # Find first { and last } — handles reasoning model thinking output
        start = content.find("{")
        end = content.rfind("}")
        if start >= 0 and end > start:
            try:
                return json.loads(content[start:end + 1])
            except json.JSONDecodeError:
                pass
        raise ValueError(f"No valid JSON found in response: {content[:200]}")

    async def categorize_issue(self, message: str, teams: list[dict]) -> dict:
        """
        Takes a Slack message and available teams, returns categorization.

        Returns:
            {"title": "...", "category": "...", "priority": "low|medium|high|critical",
             "team_name": "...", "reasoning": "..."}
        """
        teams_description = "\n".join(
            f"- {t['name']}: {t.get('description', 'No description')}"
            for t in teams
        )

        prompt = f"""Triage this production issue. Teams: {teams_description}

Issue: {message}

Return JSON: {{"title": "short title", "category": "backend|infrastructure|frontend|database|payments|other", "priority": "low|medium|high|critical", "team_name": "exact team name from above", "reasoning": "1 sentence why"}}"""

        try:
            response = await litellm.acompletion(
                **self._completion_kwargs(fast=True),
                messages=[{"role": "user", "content": prompt}],
                temperature=self.temperature,
                max_tokens=self.max_tokens,
                timeout=30,
            )

            content = response.choices[0].message.content or ""
            result = self._extract_json(content)

            # Validate required fields
            required_fields = ["title", "category", "priority", "team_name", "reasoning"]
            for field in required_fields:
                if field not in result:
                    result[field] = "unknown" if field != "priority" else "medium"

            # Normalize priority
            valid_priorities = {"low", "medium", "high", "critical"}
            if result.get("priority", "").lower() not in valid_priorities:
                result["priority"] = "medium"
            else:
                result["priority"] = result["priority"].lower()

            return result

        except Exception as e:
            logger.error(f"AI categorization failed: {e}")
            return {
                "title": message[:100] if len(message) > 100 else message,
                "category": "other",
                "priority": "medium",
                "team_name": teams[0]["name"] if teams else "unknown",
                "reasoning": f"AI categorization failed: {str(e)}. Using defaults.",
            }

    async def generate_rca(
        self,
        issue_title: str,
        issue_description: str,
        category: str,
        team_name: str,
    ) -> dict:
        """
        Generate root cause analysis. Uses Vishwakarma in production, generic AI locally.
        """
        # Production: use Vishwakarma SRE agent
        if settings.vishwakarma_url:
            return await self._generate_rca_vishwakarma(issue_title, issue_description, category, team_name)

        # Local: use generic AI
        return await self._generate_rca_generic(issue_title, issue_description, category, team_name)

    async def _generate_rca_vishwakarma(
        self, issue_title: str, issue_description: str, category: str, team_name: str
    ) -> dict:
        """Call Vishwakarma's /api/investigate endpoint for deep RCA."""
        import httpx

        question = f"Production issue: {issue_title}\n\nDescription: {issue_description}\nCategory: {category}\nTeam: {team_name}\n\nInvestigate this issue and provide root cause analysis."

        try:
            headers = {}
            if settings.vishwakarma_api_key:
                headers["Authorization"] = f"Bearer {settings.vishwakarma_api_key}"

            async with httpx.AsyncClient(timeout=float(settings.vishwakarma_timeout)) as client:
                resp = await client.post(
                    f"{settings.vishwakarma_url.rstrip('/')}/api/investigate",
                    json={"question": question, "stream": False},
                    headers=headers,
                )

            if resp.status_code != 200:
                logger.error(f"Vishwakarma returned {resp.status_code}: {resp.text[:200]}")
                return await self._generate_rca_generic(issue_title, issue_description, category, team_name)

            data = resp.json()
            # Vishwakarma returns InvestigationResult with "analysis" field (markdown RCA)
            rca_text = data.get("analysis", "")
            meta = data.get("meta", {})
            tool_outputs = data.get("tool_outputs", [])

            if not rca_text:
                logger.warning("Vishwakarma returned empty analysis, falling back to generic AI")
                return await self._generate_rca_generic(issue_title, issue_description, category, team_name)

            # Extract first paragraph as summary
            paragraphs = [p.strip() for p in rca_text.split("\n\n") if p.strip()]
            summary = paragraphs[0] if paragraphs else rca_text[:500]
            # Strip markdown headers from summary
            if summary.startswith("#"):
                summary = paragraphs[1] if len(paragraphs) > 1 else summary.lstrip("# ")

            return {
                "summary": summary,
                "full_report": rca_text,
                "root_causes": [],
                "investigation_steps": [],
                "suggested_fixes": [],
                "related_systems": [],
                "source": "vishwakarma",
                "meta": {
                    "steps": meta.get("steps"),
                    "duration_seconds": meta.get("duration_seconds"),
                    "tools_used": len(tool_outputs),
                },
            }

        except Exception as e:
            logger.error(f"Vishwakarma RCA failed: {e}, falling back to generic AI")
            return await self._generate_rca_generic(issue_title, issue_description, category, team_name)

    async def _generate_rca_generic(
        self, issue_title: str, issue_description: str, category: str, team_name: str
    ) -> dict:
        """Generic AI RCA using litellm."""
        prompt = f"""RCA for production issue. Title: {issue_title}
Description: {issue_description}
Category: {category}, Team: {team_name}

Return JSON: {{"summary": "2 sentences", "root_causes": [{{"cause": "...", "probability": "high|medium|low"}}], "investigation_steps": ["step1", "step2"], "suggested_fixes": ["fix1"], "related_systems": ["system1"]}}
Keep each array to 3 items max. Be concise."""

        try:
            response = await litellm.acompletion(
                **self._completion_kwargs(fast=False),
                messages=[{"role": "user", "content": prompt}],
                temperature=self.temperature,
                max_tokens=self.max_tokens,
                timeout=60,
            )

            content = response.choices[0].message.content or ""
            result = self._extract_json(content)

            if "summary" not in result:
                result["summary"] = "RCA analysis completed."
            for key in ["root_causes", "investigation_steps", "suggested_fixes", "related_systems"]:
                if key not in result:
                    result[key] = []
            result["source"] = "generic_ai"
            return result

        except Exception as e:
            logger.error(f"Generic AI RCA failed: {e}")
            return {
                "summary": f"Automated RCA generation failed: {str(e)}",
                "root_causes": [],
                "investigation_steps": [
                    "Check application logs for errors",
                    "Review recent deployments",
                    "Check infrastructure metrics",
                ],
                "suggested_fixes": [],
                "related_systems": [],
                "source": "fallback",
            }


ai_service = AIService()
