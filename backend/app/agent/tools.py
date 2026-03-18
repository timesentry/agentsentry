"""Agent tool definitions and execution layer.

Each tool lets the Claude agent query the AgentSentry database on behalf
of the authenticated user.
"""

from datetime import datetime, timedelta, timezone

from sqlalchemy import func

from ..extensions import db
from ..models.agent import Agent, Entry, Project

# ── Tool schemas (Anthropic format) ──────────────────────────────────

TOOL_DEFINITIONS = [
    {
        "name": "get_dashboard_stats",
        "description": (
            "Get an overview of the user's agent activity: total entries, total hours, "
            "total tokens, currently active sessions, number of agents, and number of projects."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "days": {
                    "type": "integer",
                    "description": "Look-back window in days (default 30).",
                },
            },
            "required": [],
        },
    },
    {
        "name": "get_agents",
        "description": "List all agents registered by the user with their entry counts and total tokens.",
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
    {
        "name": "get_projects",
        "description": "List all projects the user has created, including agent count and entry count.",
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
    {
        "name": "get_entries",
        "description": (
            "Fetch recent session entries. Optionally filter by agent or project. "
            "Returns start/end time, duration, token count, and description."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "agent_id": {
                    "type": "integer",
                    "description": "Filter by agent ID.",
                },
                "project_id": {
                    "type": "integer",
                    "description": "Filter by project ID.",
                },
                "days": {
                    "type": "integer",
                    "description": "Only return entries from the last N days (default 7).",
                },
                "limit": {
                    "type": "integer",
                    "description": "Max entries to return (default 20, max 50).",
                },
            },
            "required": [],
        },
    },
    {
        "name": "get_analytics",
        "description": (
            "Get aggregated usage analytics for a date range: timeline entries, "
            "hours by project, tokens by project, and a summary."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "days": {
                    "type": "integer",
                    "description": "Look-back window in days (default 30).",
                },
            },
            "required": [],
        },
    },
    {
        "name": "get_agent_summary",
        "description": "Get detailed usage statistics for a specific agent by ID.",
        "input_schema": {
            "type": "object",
            "properties": {
                "agent_id": {
                    "type": "integer",
                    "description": "The agent ID to summarize.",
                },
            },
            "required": ["agent_id"],
        },
    },
]


# ── Tool execution ────────────────────────────────────────────────────

def execute_tool(tool_name: str, tool_input: dict, user_id: int) -> str:
    """Execute a tool call and return the result as a string."""
    try:
        fn = _TOOL_HANDLERS.get(tool_name)
        if not fn:
            return f"Error: Unknown tool '{tool_name}'"
        result = fn(tool_input, user_id)
        return str(result)
    except Exception as e:
        return f"Error executing {tool_name}: {e}"


def _get_dashboard_stats(params: dict, user_id: int):
    days = params.get("days", 30)
    now = datetime.now(timezone.utc)
    since = now - timedelta(days=days)

    total_entries = Entry.query.filter(
        Entry.user_id == user_id,
        Entry.start >= since,
    ).count()

    total_ms = db.session.query(func.sum(Entry.duration)).filter(
        Entry.user_id == user_id,
        Entry.start >= since,
        Entry.duration.isnot(None),
    ).scalar() or 0

    total_tokens = db.session.query(func.sum(Entry.tokens)).filter(
        Entry.user_id == user_id,
        Entry.start >= since,
        Entry.tokens.isnot(None),
    ).scalar() or 0

    active_cutoff = now - timedelta(minutes=5)
    active_now = Entry.query.filter(
        Entry.user_id == user_id,
        (Entry.end.is_(None)) | (Entry.end >= active_cutoff),
    ).count()

    agent_count = Agent.query.filter_by(user_id=user_id).count()
    project_count = Project.query.filter_by(user_id=user_id).count()

    return {
        "period_days": days,
        "total_entries": total_entries,
        "total_hours": round(total_ms / 3_600_000, 2),
        "total_tokens": int(total_tokens),
        "active_now": active_now,
        "agent_count": agent_count,
        "project_count": project_count,
    }


def _get_agents(params: dict, user_id: int):
    agents = Agent.query.filter_by(user_id=user_id).order_by(Agent.created_at.desc()).all()
    if not agents:
        return "No agents found."
    result = []
    for a in agents:
        entry_count = a.entries.count()
        total_tokens = db.session.query(func.sum(Entry.tokens)).filter(
            Entry.agent_id == a.id,
            Entry.tokens.isnot(None),
        ).scalar() or 0
        result.append({
            "id": a.id,
            "name": a.name,
            "description": a.description,
            "entry_count": entry_count,
            "total_tokens": int(total_tokens),
            "created_at": a.created_at.isoformat(),
        })
    return result


def _get_projects(params: dict, user_id: int):
    projects = Project.query.filter_by(user_id=user_id).order_by(Project.created_at.desc()).all()
    if not projects:
        return "No projects found."
    result = []
    for p in projects:
        entry_count = p.entries.count()
        result.append({
            "id": p.id,
            "name": p.name,
            "description": p.description,
            "agent_count": p.agents.count(),
            "entry_count": entry_count,
            "created_at": p.created_at.isoformat(),
        })
    return result


def _get_entries(params: dict, user_id: int):
    days = params.get("days", 7)
    limit = min(params.get("limit", 20), 50)
    since = datetime.now(timezone.utc) - timedelta(days=days)

    query = Entry.query.filter(
        Entry.user_id == user_id,
        Entry.start >= since,
    )
    if params.get("agent_id"):
        query = query.filter(Entry.agent_id == params["agent_id"])
    if params.get("project_id"):
        query = query.filter(Entry.project_id == params["project_id"])

    entries = query.order_by(Entry.start.desc()).limit(limit).all()
    if not entries:
        return "No entries found for the given filters."
    return [e.to_dict() for e in entries]


def _get_analytics(params: dict, user_id: int):
    days = params.get("days", 30)
    now = datetime.now(timezone.utc)
    dt_from = now - timedelta(days=days)

    entries = (
        Entry.query.filter(
            Entry.user_id == user_id,
            Entry.start >= dt_from,
        )
        .order_by(Entry.start.asc())
        .all()
    )

    project_names = {
        p.id: p.name for p in Project.query.filter_by(user_id=user_id).all()
    }

    hours_by_project: dict = {}
    tokens_by_project: dict = {}
    for e in entries:
        pid = e.project_id
        label = project_names.get(pid, "Unassigned") if pid else "Unassigned"
        hours_by_project[label] = hours_by_project.get(label, 0) + (e.duration or 0)
        tokens_by_project[label] = tokens_by_project.get(label, 0) + (e.tokens or 0)

    total_ms = sum(hours_by_project.values())
    total_tokens = sum(tokens_by_project.values())

    return {
        "period_days": days,
        "total_entries": len(entries),
        "total_hours": round(total_ms / 3_600_000, 2),
        "total_tokens": int(total_tokens),
        "hours_by_project": [
            {"project": k, "hours": round(v / 3_600_000, 2)}
            for k, v in hours_by_project.items()
        ],
        "tokens_by_project": [
            {"project": k, "tokens": int(v)}
            for k, v in tokens_by_project.items()
        ],
    }


def _get_agent_summary(params: dict, user_id: int):
    agent = Agent.query.filter_by(id=params["agent_id"], user_id=user_id).first()
    if not agent:
        return "Error: Agent not found."

    total_entries = agent.entries.count()
    total_ms = db.session.query(func.sum(Entry.duration)).filter(
        Entry.agent_id == agent.id,
        Entry.duration.isnot(None),
    ).scalar() or 0
    total_tokens = db.session.query(func.sum(Entry.tokens)).filter(
        Entry.agent_id == agent.id,
        Entry.tokens.isnot(None),
    ).scalar() or 0

    recent = (
        agent.entries
        .order_by(Entry.start.desc())
        .limit(5)
        .all()
    )

    return {
        "id": agent.id,
        "name": agent.name,
        "description": agent.description,
        "total_entries": total_entries,
        "total_hours": round(total_ms / 3_600_000, 2),
        "total_tokens": int(total_tokens),
        "recent_entries": [e.to_dict() for e in recent],
    }


_TOOL_HANDLERS = {
    "get_dashboard_stats": _get_dashboard_stats,
    "get_agents": _get_agents,
    "get_projects": _get_projects,
    "get_entries": _get_entries,
    "get_analytics": _get_analytics,
    "get_agent_summary": _get_agent_summary,
}
