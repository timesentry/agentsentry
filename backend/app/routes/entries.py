from flask import request
from flask_login import current_user, login_required
from flask_restx import Namespace, Resource

from ..extensions import db
from ..models.agent import Entry, Project

ns = Namespace("entries", description="Time entries")


@ns.route("/")
class EntryList(Resource):
    @login_required
    def get(self):
        """List the current user's entries, newest first."""
        limit = min(int(request.args.get("limit", 100)), 500)
        agent_id = request.args.get("agent_id", type=int)
        project_id = request.args.get("project_id", type=int)

        q = Entry.query.filter_by(user_id=current_user.id)
        if agent_id:
            q = q.filter_by(agent_id=agent_id)
        if project_id:
            q = q.filter_by(project_id=project_id)

        return [e.to_dict() for e in q.order_by(Entry.start.desc()).limit(limit).all()], 200


@ns.route("/<int:entry_id>")
class EntryDetail(Resource):
    def _get(self, entry_id):
        entry = db.get_or_404(Entry, entry_id)
        if entry.user_id != current_user.id:
            ns.abort(403)
        return entry

    @login_required
    def get(self, entry_id):
        """Get an entry including full transcript."""
        return self._get(entry_id).to_dict(), 200

    @login_required
    def patch(self, entry_id):
        """Update entry metadata (description, project)."""
        entry = self._get(entry_id)
        data = request.get_json() or {}

        if "description" in data:
            entry.description = data["description"]
        if "project_id" in data:
            if data["project_id"] is not None:
                project = db.get_or_404(Project, data["project_id"])
                if project.user_id != current_user.id:
                    ns.abort(403)
            entry.project_id = data["project_id"]

        db.session.commit()
        return entry.to_dict(), 200


@ns.route("/<int:entry_id>/transcript")
class EntryTranscript(Resource):
    @login_required
    def get(self, entry_id):
        """Get the raw transcript for an entry."""
        entry = db.get_or_404(Entry, entry_id)
        if entry.user_id != current_user.id:
            ns.abort(403)
        return {"transcript": entry.transcript}, 200
