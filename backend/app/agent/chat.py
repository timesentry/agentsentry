"""Agentic chat loop using the Anthropic SDK with tool use."""

import json
import os

import anthropic

from .tools import TOOL_DEFINITIONS, execute_tool

MODEL = "claude-sonnet-4-20250514"
MAX_TOOL_ROUNDS = 10


def build_system_prompt(user) -> str:
    from ..models.agent import Agent

    agent_count = Agent.query.filter_by(user_id=user.id).count()

    return f"""You are an AI analytics assistant for AgentSentry, an open-source agent time & token tracking platform.

Current user: {user.email}
Agents tracked: {agent_count}

You help users understand their AI agent usage patterns — time spent, tokens consumed, which agents and projects are most active, trends, and anomalies.

Guidelines:
- Be concise and data-driven. When asked about usage metrics, pull data with tools before answering.
- Offer insights and observations about patterns you notice in the data.
- Never fabricate numbers. If you don't have data, say so.
- Keep responses short and focused.
"""


def run_chat(user, messages: list[dict]) -> dict:
    """Run the agentic chat loop.

    Args:
        user: The authenticated User model instance
        messages: List of {"role": "user"|"assistant", "content": "..."} messages

    Returns:
        {"response": str, "tool_actions": list[dict]}
    """
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        return {
            "response": "The Anthropic API key is not configured. Please add ANTHROPIC_API_KEY to your .env file.",
            "tool_actions": [],
        }

    client = anthropic.Anthropic(api_key=api_key)
    system_prompt = build_system_prompt(user)
    tool_actions = []

    api_messages = [{"role": m["role"], "content": m["content"]} for m in messages]

    for _round in range(MAX_TOOL_ROUNDS):
        response = client.messages.create(
            model=MODEL,
            max_tokens=2048,
            system=system_prompt,
            tools=TOOL_DEFINITIONS,
            messages=api_messages,
        )

        if response.stop_reason == "tool_use":
            assistant_content = []
            tool_uses = []

            for block in response.content:
                if block.type == "text":
                    assistant_content.append({"type": "text", "text": block.text})
                elif block.type == "tool_use":
                    assistant_content.append({
                        "type": "tool_use",
                        "id": block.id,
                        "name": block.name,
                        "input": block.input,
                    })
                    tool_uses.append(block)

            api_messages.append({"role": "assistant", "content": assistant_content})

            tool_results = []
            for tool_use in tool_uses:
                result = execute_tool(tool_use.name, tool_use.input, user.id)
                tool_actions.append({
                    "tool": tool_use.name,
                    "input": tool_use.input,
                    "result_preview": str(result)[:200],
                })
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": tool_use.id,
                    "content": json.dumps(result) if not isinstance(result, str) else result,
                })

            api_messages.append({"role": "user", "content": tool_results})
            continue

        final_text = "".join(
            block.text for block in response.content if block.type == "text"
        )
        return {"response": final_text, "tool_actions": tool_actions}

    return {
        "response": "I've hit my action limit for this turn. Could you break your request into smaller steps?",
        "tool_actions": tool_actions,
    }
