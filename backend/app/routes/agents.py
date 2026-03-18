from flask_login import current_user, login_required
from flask_restx import Namespace, Resource, fields

from ..extensions import db
from ..models.agent import Agent

ns = Namespace("agents", description="Agent management")

agent_input = ns.model(
    "AgentInput",
    {
        "name": fields.String(required=True),
        "description": fields.String(),
        "icon": fields.String(description="Filesystem path to icon"),
    },
)


@ns.route("/")
class AgentList(Resource):
    @login_required
    def get(self):
        """List the current user's agents."""
        agents = (
            Agent.query.filter_by(user_id=current_user.id)
            .order_by(Agent.created_at.desc())
            .all()
        )
        return [a.to_dict() for a in agents], 200

    @login_required
    @ns.expect(agent_input)
    def post(self):
        """Create an agent and generate its API key."""
        data = ns.payload
        if not data.get("name"):
            return {"error": "name is required"}, 400

        agent = Agent(
            user_id=current_user.id,
            name=data["name"],
            description=data.get("description"),
            icon=data.get("icon"),
            api_key=Agent.generate_api_key(),
        )
        db.session.add(agent)
        db.session.commit()
        return agent.to_dict(include_key=True), 201


@ns.route("/<int:agent_id>")
class AgentDetail(Resource):
    def _get(self, agent_id):
        agent = db.get_or_404(Agent, agent_id)
        if agent.user_id != current_user.id:
            ns.abort(403)
        return agent

    @login_required
    def get(self, agent_id):
        """Get an agent."""
        return self._get(agent_id).to_dict(), 200

    @login_required
    @ns.expect(agent_input)
    def patch(self, agent_id):
        """Update an agent."""
        agent = self._get(agent_id)
        data = ns.payload
        if "name" in data:
            agent.name = data["name"]
        if "description" in data:
            agent.description = data["description"]
        if "icon" in data:
            agent.icon = data["icon"]
        db.session.commit()
        return agent.to_dict(), 200

    @login_required
    def delete(self, agent_id):
        """Delete an agent."""
        agent = self._get(agent_id)
        db.session.delete(agent)
        db.session.commit()
        return {"message": "deleted"}, 200


@ns.route("/<int:agent_id>/rotate-key")
class AgentRotateKey(Resource):
    @login_required
    def post(self, agent_id):
        """Rotate an agent's API key."""
        agent = db.get_or_404(Agent, agent_id)
        if agent.user_id != current_user.id:
            ns.abort(403)
        agent.api_key = Agent.generate_api_key()
        db.session.commit()
        return agent.to_dict(include_key=True), 200
