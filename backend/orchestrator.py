import os
from agents import run_openai_agents, run_template_agents


def run_workflow(goal: str, api_key: str | None, mode: str):
    user_key = api_key.strip() if api_key else None
    server_key = os.getenv("OPENAI_API_KEY")

    if user_key:
        try:
            return run_openai_agents(goal, mode, user_key, source="user-openai")
        except Exception as e:
            print("User OpenAI failed:", repr(e))

    if server_key:
        try:
            return run_openai_agents(goal, mode, server_key, source="server-openai")
        except Exception as e:
            print("Server OpenAI failed:", repr(e))

    return run_template_agents(goal, mode)