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
        issue_id=None,
        db_session_maker=None,
    ) -> dict:
        """
        Generate root cause analysis. Uses Vishwakarma streaming in production, generic AI locally.
        """
        if settings.vishwakarma_url:
            return await self._generate_rca_vishwakarma(
                issue_title, issue_description, category, team_name,
                issue_id=issue_id, db_session_maker=db_session_maker,
            )
        return await self._generate_rca_generic(issue_title, issue_description, category, team_name)

    async def _generate_rca_vishwakarma(
        self, issue_title: str, issue_description: str, category: str, team_name: str,
        issue_id=None, db_session_maker=None,
    ) -> dict:
        """
        Stream Vishwakarma's /api/investigate/stream SSE endpoint.
        Saves live progress to DB so frontend can show steps in real-time.
        Falls back to generic AI on failure.
        """
        import httpx

        question = (
            f"Production issue: {issue_title}\n\n"
            f"Description: {issue_description}\n"
            f"Category: {category}\nTeam: {team_name}\n\n"
            f"Investigate this issue and provide root cause analysis."
        )

        try:
            headers = {"Accept": "text/event-stream"}
            if settings.vishwakarma_api_key:
                headers["Authorization"] = f"Bearer {settings.vishwakarma_api_key}"

            tool_calls = []
            analysis_text = ""

            async with httpx.AsyncClient(timeout=httpx.Timeout(float(settings.vishwakarma_timeout), connect=30.0)) as client:
                async with client.stream(
                    "POST",
                    f"{settings.vishwakarma_url.rstrip('/')}/api/investigate/stream",
                    json={"question": question, "stream": True},
                    headers=headers,
                ) as resp:
                    if resp.status_code != 200:
                        logger.error(f"Vishwakarma stream returned {resp.status_code}")
                        return await self._generate_rca_generic(issue_title, issue_description, category, team_name)

                    current_event = ""
                    current_data = ""

                    async for line in resp.aiter_lines():
                        line = line.strip()

                        if line.startswith("event: "):
                            current_event = line[7:]
                            continue

                        if line.startswith("data: "):
                            current_data = line[6:]

                            # Parse the SSE event
                            try:
                                data = json.loads(current_data) if current_data else {}
                            except json.JSONDecodeError:
                                continue

                            logger.debug(f"Vishwakarma event={current_event!r} data={current_data[:120]}")

                            if current_event == "tool_call_start":
                                tool_name = (
                                    data.get("tool_name")
                                    or data.get("name")
                                    or data.get("content")
                                    or data.get("tool")
                                    or "unknown"
                                )
                                tool_calls.append({"tool": tool_name, "status": "running"})
                                logger.info(f"Vishwakarma tool call: {tool_name}")

                                if issue_id and db_session_maker:
                                    await self._save_rca_progress(
                                        issue_id, db_session_maker, tool_calls, None
                                    )

                            elif current_event == "tool_call_result":
                                tool_name = (
                                    data.get("tool_name")
                                    or data.get("name")
                                    or data.get("content")
                                    or data.get("tool")
                                    or "unknown"
                                )
                                for tc in reversed(tool_calls):
                                    if tc["tool"] == tool_name and tc["status"] == "running":
                                        tc["status"] = "done"
                                        break

                                if issue_id and db_session_maker:
                                    await self._save_rca_progress(
                                        issue_id, db_session_maker, tool_calls, None
                                    )

                            elif current_event in ("analysis_chunk", "text_delta"):
                                chunk = data.get("text") or data.get("chunk") or data.get("content", "")
                                analysis_text += chunk

                            elif current_event == "analysis_done":
                                analysis_text = data.get("analysis") or data.get("text") or analysis_text

                            elif current_event in ("done", "message_stop", "stream_end"):
                                break

                            elif current_event == "error":
                                logger.error(f"Vishwakarma stream error: {data.get('message')}")
                                break

                            elif current_event:
                                logger.warning(f"Vishwakarma unknown event={current_event!r} data={current_data[:200]}")

                            current_event = ""
                            current_data = ""

            if not analysis_text:
                logger.warning("Vishwakarma stream produced no analysis, falling back")
                return await self._generate_rca_generic(issue_title, issue_description, category, team_name)

            # Extract summary
            paragraphs = [p.strip() for p in analysis_text.split("\n\n") if p.strip()]
            summary = paragraphs[0] if paragraphs else analysis_text[:500]
            if summary.startswith("#"):
                summary = paragraphs[1] if len(paragraphs) > 1 else summary.lstrip("# ")

            tools_used = len([t for t in tool_calls if t["status"] == "done"])

            return {
                "summary": summary,
                "full_report": analysis_text,
                "root_causes": [],
                "investigation_steps": [],
                "suggested_fixes": [],
                "related_systems": [],
                "source": "vishwakarma",
                "tools_called": tools_used,
                "tool_details": tool_calls,
            }

        except Exception as e:
            logger.error(f"Vishwakarma stream RCA failed: {e}, falling back to generic AI")
            return await self._generate_rca_generic(issue_title, issue_description, category, team_name)

    @staticmethod
    async def _save_rca_progress(issue_id, db_session_maker, tool_calls: list, analysis: str | None):
        """Save in-progress RCA to DB so frontend can show live steps."""
        try:
            from app.models.issue import Issue
            async with db_session_maker() as db:
                from sqlalchemy import select
                stmt = select(Issue).where(Issue.id == issue_id)
                result = await db.execute(stmt)
                issue = result.scalar_one_or_none()
                if issue:
                    tools_done = len([t for t in tool_calls if t["status"] == "done"])
                    tools_running = len([t for t in tool_calls if t["status"] == "running"])
                    issue.ai_rca = {
                        "status": "investigating",
                        "tools_called": tools_done,
                        "tools_running": tools_running,
                        "tool_details": tool_calls[-5:],  # last 5 for display
                        "summary": f"Investigating... {tools_done} tools checked" + (f", {tools_running} running" if tools_running else ""),
                        "source": "vishwakarma",
                    }
                    await db.commit()
        except Exception as e:
            logger.debug(f"Failed to save RCA progress: {e}")

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
