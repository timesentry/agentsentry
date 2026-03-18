from flask import request
from flask_login import current_user, login_required
from flask_restx import Namespace, Resource

from ..agent.chat import run_chat

ns = Namespace("chat", description="AI agent chat")


@ns.route("/message")
class ChatMessage(Resource):
    @login_required
    def post(self):
        """Send a message to the AI analytics agent.

        Expects JSON body:
        {
            "messages": [
                {"role": "user", "content": "..."},
                {"role": "assistant", "content": "..."},
                ...
            ]
        }
        """
        data = request.get_json()
        messages = data.get("messages", [])

        if not messages:
            return {"error": "No messages provided"}, 400

        result = run_chat(current_user, messages)

        return {
            "response": result["response"],
            "tool_actions": result["tool_actions"],
        }, 200
