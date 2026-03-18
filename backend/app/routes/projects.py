from flask_login import current_user, login_required
from flask_restx import Namespace, Resource, fields

from ..extensions import db
from ..models.agent import Agent, Project

ns = Namespace("projects", description="Project management")

project_input = ns.model(
    "ProjectInput",
    {
        "name": fields.String(required=True),
        "description": fields.String(),
        "agent_ids": fields.List(fields.Integer, description="Agent IDs to associate"),
    },
)


@ns.route("/")
class ProjectList(Resource):
    @login_required
    def get(self):
        """List the current user's projects."""
        projects = (
            Project.query.filter_by(user_id=current_user.id)
            .order_by(Project.created_at.desc())
            .all()
        )
        return [p.to_dict() for p in projects], 200

    @login_required
    @ns.expect(project_input)
    def post(self):
        """Create a project."""
        data = ns.payload
        if not data.get("name"):
            return {"error": "name is required"}, 400

        project = Project(
            user_id=current_user.id,
            name=data["name"],
            description=data.get("description"),
        )
        agent_ids = data.get("agent_ids") or []
        if agent_ids:
            agents = Agent.query.filter(
                Agent.id.in_(agent_ids), Agent.user_id == current_user.id
            ).all()
            project.agents = agents

        db.session.add(project)
        db.session.commit()
        return project.to_dict(), 201


@ns.route("/<int:project_id>")
class ProjectDetail(Resource):
    def _get(self, project_id):
        project = db.get_or_404(Project, project_id)
        if project.user_id != current_user.id:
            ns.abort(403)
        return project

    @login_required
    def get(self, project_id):
        """Get a project."""
        project = self._get(project_id)
        d = project.to_dict()
        d["agents"] = [a.to_dict() for a in project.agents]
        return d, 200

    @login_required
    @ns.expect(project_input)
    def patch(self, project_id):
        """Update a project."""
        project = self._get(project_id)
        data = ns.payload
        if "name" in data:
            project.name = data["name"]
        if "description" in data:
            project.description = data["description"]
        if "agent_ids" in data:
            agents = Agent.query.filter(
                Agent.id.in_(data["agent_ids"]), Agent.user_id == current_user.id
            ).all()
            project.agents = agents
        db.session.commit()
        return project.to_dict(), 200

    @login_required
    def delete(self, project_id):
        """Delete a project."""
        project = self._get(project_id)
        db.session.delete(project)
        db.session.commit()
        return {"message": "deleted"}, 200
