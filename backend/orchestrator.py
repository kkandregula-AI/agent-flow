import os
from agents import run_openai_agents, run_local_ollama_agents, run_template_agents

def run_workflow(goal: str, api_key: str | None, mode: str):
    user_key = api_key.strip() if api_key else None
    server_key = os.getenv("OPENAI_API_KEY")

    # 1. User-provided OpenAI key
    if user_key:
        try:
            return run_openai_agents(goal, mode, user_key, source="user-openai")
        except Exception as e:
            print("User OpenAI failed, falling back:", e)

    # 2. Server OpenAI key
    if server_key:
        try:
            return run_openai_agents(goal, mode, server_key, source="server-openai")
        except Exception as e:
            print("Server OpenAI failed, falling back:", e)

    # 3. Ollama only for local dev
    if os.getenv("ENABLE_OLLAMA", "false").lower() == "true":
        try:
            return run_local_ollama_agents(goal, mode)
        except Exception as e:
            print("Ollama failed, falling back:", e)

    # 4. Hosted-safe fallback
    return run_template_agents(goal, mode)