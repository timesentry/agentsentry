"""
Agent-facing session endpoint.

Agents POST their session_id and transcript here, authenticated via Bearer token (API key).
Mirrors the timesentry.ai /api/v2/agent-entities/sessions/ contract so the
timesentry-agent-plugin can point at agentsentry with zero changes.
"""
import json
import logging
import os
import threading
from datetime import datetime, timezone

import anthropic
from flask import current_app, request
from pydantic import BaseModel
from flask_restx import Namespace, Resource, fields
from sqlalchemy.exc import IntegrityError

from ..extensions import db
from ..models.agent import Agent, Entry, Project

log = logging.getLogger(__name__)

ns = Namespace("v1/sessions", description="Agent session ingestion")

session_input = ns.model(
    "SessionInput",
    {
        "session_id": fields.String(required=True, description="Unique session identifier"),
        "transcript": fields.String(required=True, description="Raw Claude Code transcript content"),
        "started_at": fields.String(description="ISO-8601 UTC timestamp when the session started (optional)"),
    },
)


def _sum_tokens(obj):
    """Recursively sum input_tokens + output_tokens from any JSON structure."""
    total = 0
    if isinstance(obj, dict):
        total += obj.get("input_tokens", 0) or 0
        total += obj.get("output_tokens", 0) or 0
        for v in obj.values():
            total += _sum_tokens(v)
    elif isinstance(obj, list):
        for item in obj:
            total += _sum_tokens(item)
    return total


def extract_tokens(transcript_str: str) -> int:
    """Extract total token count from Claude Code transcript string."""
    if not transcript_str:
        return 0
    try:
        return _sum_tokens(json.loads(transcript_str))
    except (json.JSONDecodeError, TypeError):
        pass
    total = 0
    for line in transcript_str.splitlines():
        line = line.strip()
        if line:
            try:
                total += _sum_tokens(json.loads(line))
            except (json.JSONDecodeError, TypeError):
                pass
    return total


CLASSIFY_MODEL = "claude-haiku-4-5"
NEW_CONTENT_THRESHOLD = 500  # min new chars before reclassifying
MAX_SNIPPET_CHARS = 8000


class ClassifyResult(BaseModel):
    description: str
    project_id: int | None = None


def _classify_entry(app, entry_id, agent_id, transcript_str):
    """Background task: use AI to incrementally classify a session."""
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        return

    with app.app_context():
        entry = Entry.query.get(entry_id)
        if not entry:
            return

        offset = entry.classified_offset or 0
        new_content = transcript_str[offset:]

        if len(new_content) < NEW_CONTENT_THRESHOLD:
            return

        agent = Agent.query.get(agent_id)
        if not agent:
            return

        projects = agent.projects
        if not projects:
            project_list = "No projects available — set project_id to null."
        else:
            project_list = "\n".join(
                f"- id={p.id}, name=\"{p.name}\", description=\"{p.description or ''}\""
                for p in projects
            )

        # Truncate new content if huge
        snippet = new_content[:MAX_SNIPPET_CHARS]
        if len(new_content) > MAX_SNIPPET_CHARS:
            snippet += "\n... (truncated)"

        existing_desc = entry.description or ""

        if existing_desc:
            prompt = f"""You are maintaining a running description of a Claude Code session.

Current description: "{existing_desc}"

New activity since last update:
{snippet}

1. Update the description to include what was newly accomplished. Keep it concise (max 200 chars). Preserve what was already described.
2. Pick the most relevant project from the list below, or null if none fit.

Projects:
{project_list}

Return a JSON object with "description" and "project_id"."""
        else:
            prompt = f"""Analyze this Claude Code session transcript and:
1. Write a short description (1 sentence, max 120 chars) summarizing what was accomplished.
2. Pick the most relevant project from the list below, or null if none fit.

Projects:
{project_list}

Transcript:
{snippet}

Return a JSON object with "description" and "project_id"."""

        try:
            client = anthropic.Anthropic(api_key=api_key)
            response = client.messages.parse(
                model=CLASSIFY_MODEL,
                max_tokens=256,
                messages=[{"role": "user", "content": prompt}],
                output_format=ClassifyResult,
            )
            result = response.parsed_output
        except Exception:
            log.exception("AI classification failed for entry %s", entry_id)
            return

        # Re-fetch in case it changed during the API call
        entry = Entry.query.get(entry_id)
        if not entry:
            return

        if result.description:
            entry.description = result.description[:255]

        pid = result.project_id
        if pid is not None:
            valid_ids = {p.id for p in projects}
            if pid in valid_ids:
                entry.project_id = pid

        entry.classified_offset = len(transcript_str)
        db.session.commit()


def _get_agent():
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None
    return Agent.query.filter_by(api_key=auth[7:]).first()


@ns.route("/")
class Sessions(Resource):
    @ns.expect(session_input)
    @ns.response(202, "Accepted")
    @ns.response(400, "Bad request")
    @ns.response(401, "Unauthorized")
    def post(self):
        """Ingest an agent session (create or update)."""
        agent = _get_agent()
        if not agent:
            return {"error": "Invalid API key"}, 401

        data = ns.payload
        session_id = data.get("session_id")
        if not session_id:
            return {"error": "session_id is required"}, 400

        transcript_str = data.get("transcript", "") or ""
        now = datetime.now(timezone.utc)

        started_at = None
        if data.get("started_at"):
            try:
                started_at = datetime.fromisoformat(data["started_at"].replace("Z", "+00:00"))
            except ValueError:
                pass

        tokens = extract_tokens(transcript_str)

        # Transcripts are JSONL — parse each line into a list
        transcript_data = None
        if transcript_str:
            lines = [l.strip() for l in transcript_str.splitlines() if l.strip()]
            parsed = []
            for line in lines:
                try:
                    parsed.append(json.loads(line))
                except (json.JSONDecodeError, TypeError):
                    pass
            if parsed:
                transcript_data = parsed

        def _apply(entry):
            entry.end = now
            entry.tokens = tokens
            entry.transcript = transcript_data
            if entry.start and entry.end:
                delta = entry.end - entry.start
                entry.duration = max(0, int(delta.total_seconds() * 1000))

        entry = Entry.query.filter_by(session_id=session_id).first()
        if entry is None:
            entry = Entry(
                session_id=session_id,
                start=started_at or now,
                agent_id=agent.id,
                user_id=agent.user_id,
            )
            db.session.add(entry)

        _apply(entry)

        try:
            db.session.commit()
        except IntegrityError:
            # Race condition: two hooks fired simultaneously; roll back and update
            db.session.rollback()
            entry = Entry.query.filter_by(session_id=session_id).first()
            if entry is None:
                return {"error": "session conflict"}, 409
            _apply(entry)
            db.session.commit()

        if transcript_str:
            app = current_app._get_current_object()
            threading.Thread(
                target=_classify_entry,
                args=(app, entry.id, agent.id, transcript_str),
                daemon=True,
            ).start()

        return {"status": "accepted", "entry_id": entry.id}, 202


heartbeat_input = ns.model(
    "HeartbeatInput",
    {
        "session_id": fields.String(required=True, description="Unique session identifier"),
    },
)


@ns.route("/heartbeat")
class Heartbeat(Resource):
    @ns.expect(heartbeat_input)
    @ns.response(202, "Accepted")
    @ns.response(400, "Bad request")
    @ns.response(401, "Unauthorized")
    def post(self):
        """Lightweight ping to keep a session alive (updates end timestamp)."""
        agent = _get_agent()
        if not agent:
            return {"error": "Invalid API key"}, 401

        data = ns.payload
        session_id = data.get("session_id")
        if not session_id:
            return {"error": "session_id is required"}, 400

        now = datetime.now(timezone.utc)

        entry = Entry.query.filter_by(session_id=session_id).first()
        if entry is None:
            entry = Entry(
                session_id=session_id,
                start=now,
                agent_id=agent.id,
                user_id=agent.user_id,
            )
            db.session.add(entry)

        entry.end = now
        if entry.start and entry.end:
            delta = entry.end - entry.start
            entry.duration = max(0, int(delta.total_seconds() * 1000))

        try:
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            entry = Entry.query.filter_by(session_id=session_id).first()
            if entry is None:
                return {"error": "session conflict"}, 409
            entry.end = now
            if entry.start and entry.end:
                delta = entry.end - entry.start
                entry.duration = max(0, int(delta.total_seconds() * 1000))
            db.session.commit()

        return {"status": "accepted", "entry_id": entry.id}, 202
