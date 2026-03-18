import secrets
from datetime import datetime, timezone
from ..extensions import db


project_agents = db.Table(
    "project_agents",
    db.Column("project_id", db.Integer, db.ForeignKey("project.id"), primary_key=True),
    db.Column("agent_id", db.Integer, db.ForeignKey("agent.id"), primary_key=True),
)


class Project(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, index=True)
    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    agents = db.relationship("Agent", secondary=project_agents, backref="projects", lazy="dynamic")
    entries = db.relationship("Entry", backref="project", lazy="dynamic")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "created_at": self.created_at.isoformat(),
            "agent_count": self.agents.count(),
        }


class Agent(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, index=True)
    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)
    icon = db.Column(db.String(500))  # filesystem path
    api_key = db.Column(db.String(255), unique=True, nullable=False, index=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    entries = db.relationship("Entry", backref="agent", lazy="dynamic")

    @staticmethod
    def generate_api_key():
        return "tsk_" + secrets.token_urlsafe(32)

    def to_dict(self, include_key=False):
        d = {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "icon": self.icon,
            "created_at": self.created_at.isoformat(),
        }
        if include_key:
            d["api_key"] = self.api_key
        return d


class Entry(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, index=True)
    session_id = db.Column(db.String(255), unique=True, index=True)
    start = db.Column(db.DateTime(timezone=True), nullable=False)
    end = db.Column(db.DateTime(timezone=True))
    duration = db.Column(db.Integer)  # milliseconds
    tokens = db.Column(db.Integer)
    description = db.Column(db.Text)
    transcript = db.Column(db.JSON)
    agent_id = db.Column(db.Integer, db.ForeignKey("agent.id"), nullable=False)
    project_id = db.Column(db.Integer, db.ForeignKey("project.id"))
    classified_offset = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id": self.id,
            "session_id": self.session_id,
            "start": self.start.isoformat() if self.start else None,
            "end": self.end.isoformat() if self.end else None,
            "duration": self.duration,
            "tokens": self.tokens,
            "description": self.description,
            "agent_id": self.agent_id,
            "agent_name": self.agent.name if self.agent else None,
            "project_id": self.project_id,
            "project_name": self.project.name if self.project else None,
            "created_at": self.created_at.isoformat(),
        }
