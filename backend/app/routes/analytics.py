"""
Analytics endpoint.

GET /api/analytics/?from=<ISO>&to=<ISO>

Returns:
  - timeline: entries in range (for Gantt/timeline rendering)
  - hours_by_project: [{ project_id, project_name, hours }]
  - tokens_by_project: [{ project_id, project_name, tokens }]
  - summary: { total_entries, total_hours, total_tokens, active_now }
"""
from datetime import datetime, timedelta, timezone

from flask import request
from flask_login import current_user, login_required
from flask_restx import Namespace, Resource
from sqlalchemy import func

from ..extensions import db
from ..models.agent import Entry, Project

ns = Namespace("analytics", description="Usage analytics")


def _parse_dt(s: str, default: datetime, end_of_day: bool = False) -> datetime:
    if not s:
        return default
    try:
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        # Date-only strings (e.g. "2026-03-17") parse as midnight;
        # bump to end of day so the full day is included in range queries.
        if end_of_day and "T" not in s:
            dt = dt.replace(hour=23, minute=59, second=59, tzinfo=timezone.utc)
        return dt
    except ValueError:
        return default


@ns.route("/")
class Analytics(Resource):
    @login_required
    def get(self):
        """Return analytics for a date range (default: last 30 days)."""
        now = datetime.now(timezone.utc)
        dt_from = _parse_dt(request.args.get("from"), now - timedelta(days=30))
        dt_to = _parse_dt(request.args.get("to"), now, end_of_day=True)

        uid = current_user.id

        # ── Timeline ─────────────────────────────────────────────────────────
        timeline_entries = (
            Entry.query.filter(
                Entry.user_id == uid,
                Entry.start >= dt_from,
                Entry.start <= dt_to,
            )
            .order_by(Entry.start.asc())
            .all()
        )
        timeline = [
            {
                "id": e.id,
                "session_id": e.session_id,
                "start": e.start.isoformat() if e.start else None,
                "end": e.end.isoformat() if e.end else None,
                "duration": e.duration,
                "tokens": e.tokens,
                "agent_id": e.agent_id,
                "agent_name": e.agent.name if e.agent else None,
                "project_id": e.project_id,
                "project_name": e.project.name if e.project else None,
                "description": e.description,
            }
            for e in timeline_entries
        ]

        # ── Hours by project ─────────────────────────────────────────────────
        hours_rows = (
            db.session.query(
                Entry.project_id,
                func.sum(Entry.duration).label("total_ms"),
            )
            .filter(
                Entry.user_id == uid,
                Entry.start >= dt_from,
                Entry.start <= dt_to,
                Entry.duration.isnot(None),
            )
            .group_by(Entry.project_id)
            .all()
        )
        project_names = {p.id: p.name for p in Project.query.filter_by(user_id=uid).all()}
        hours_by_project = [
            {
                "project_id": row.project_id,
                "project_name": project_names.get(row.project_id, "Unassigned"),
                "hours": round((row.total_ms or 0) / 3_600_000, 2),
            }
            for row in hours_rows
        ]

        # ── Tokens by project ────────────────────────────────────────────────
        tokens_rows = (
            db.session.query(
                Entry.project_id,
                func.sum(Entry.tokens).label("total_tokens"),
            )
            .filter(
                Entry.user_id == uid,
                Entry.start >= dt_from,
                Entry.start <= dt_to,
                Entry.tokens.isnot(None),
            )
            .group_by(Entry.project_id)
            .all()
        )
        tokens_by_project = [
            {
                "project_id": row.project_id,
                "project_name": project_names.get(row.project_id, "Unassigned"),
                "tokens": int(row.total_tokens or 0),
            }
            for row in tokens_rows
        ]

        # ── Summary ──────────────────────────────────────────────────────────
        total_ms = sum((r["hours"] * 3_600_000) for r in hours_by_project)
        total_tokens = sum(r["tokens"] for r in tokens_by_project)

        active_cutoff = now - timedelta(minutes=5)
        active_now = Entry.query.filter(
            Entry.user_id == uid,
            (Entry.end.is_(None)) | (Entry.end >= active_cutoff),
        ).count()

        return {
            "timeline": timeline,
            "hours_by_project": hours_by_project,
            "tokens_by_project": tokens_by_project,
            "summary": {
                "total_entries": len(timeline_entries),
                "total_hours": round(total_ms / 3_600_000, 2),
                "total_tokens": int(total_tokens),
                "active_now": active_now,
            },
            "range": {
                "from": dt_from.isoformat(),
                "to": dt_to.isoformat(),
            },
        }, 200
