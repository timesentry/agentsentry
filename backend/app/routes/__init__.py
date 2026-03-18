from flask import Blueprint
from flask_restx import Api

api_bp = Blueprint("api", __name__, url_prefix="/api")

api = Api(
    api_bp,
    version="1.0",
    title="AgentSentry API",
    description="Open-source agent time & token tracking",
    doc="/docs",
)

from .auth import ns as auth_ns          # noqa: E402
from .agents import ns as agents_ns      # noqa: E402
from .projects import ns as projects_ns  # noqa: E402
from .entries import ns as entries_ns    # noqa: E402
from .analytics import ns as analytics_ns  # noqa: E402
from .sessions import ns as sessions_ns  # noqa: E402
from .chat import ns as chat_ns          # noqa: E402

api.add_namespace(auth_ns)
api.add_namespace(agents_ns)
api.add_namespace(projects_ns)
api.add_namespace(entries_ns)
api.add_namespace(analytics_ns)
api.add_namespace(sessions_ns)
api.add_namespace(chat_ns)
