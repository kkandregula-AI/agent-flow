import os
import time
import requests
from openai import OpenAI

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434/api/generate")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

def _cost_estimate(tokens: int) -> float:
    return round(tokens * 0.00001, 4)

def run_openai_agents(goal: str, mode: str, api_key: str, source: str = "openai"):
    client = OpenAI(api_key=api_key)

    agent_prompts = {
        "Planner": f"You are the Planner Agent. Break this goal into clear execution steps.\nGoal: {goal}",
        "Research": f"You are the Research Agent. Identify context, risks, assumptions, and useful insights.\nGoal: {goal}",
        "Writer": f"You are the Writer Agent. Produce a strong user-facing deliverable for this goal.\nGoal: {goal}",
        "Reviewer": f"You are the Reviewer Agent. Validate completeness, clarity, and alignment to the original goal.\nGoal: {goal}",
    }

    results = {}
    final_goal_output = ""
    summary_lines = []

    for agent, prompt in agent_prompts.items():
        start = time.time()

        response = client.responses.create(
            model=OPENAI_MODEL,
            input=prompt
        )

        elapsed_ms = int((time.time() - start) * 1000)
        text = response.output_text or f"{agent} completed the assigned task."
        usage = getattr(response, "usage", None)
        total_tokens = getattr(usage, "total_tokens", 0) if usage else 0

        results[agent] = {
            "output": text,
            "time": elapsed_ms,
            "tokens": total_tokens,
            "cost": _cost_estimate(total_tokens),
            "status": "completed"
        }

        summary_lines.append(f"{agent} completed in {elapsed_ms} ms")

        if agent == "Writer":
            final_goal_output = text

    if not final_goal_output:
        final_goal_output = f"Completed response for goal: {goal}"

    return {
        "source": source,
        "agents": results,
        "goal_output": final_goal_output,
        "workflow_summary": " | ".join(summary_lines)
    }

def run_local_ollama_agents(goal: str, mode: str):
    agents = ["Planner", "Research", "Writer", "Reviewer"]
    results = {}
    final_goal_output = ""

    for agent in agents:
        start = time.time()
        prompt = f"{agent} Agent working on goal: {goal}"

        res = requests.post(
            OLLAMA_URL,
            json={"model": "llama3", "prompt": prompt, "stream": False},
            timeout=90
        )
        res.raise_for_status()
        payload = res.json()

        elapsed_ms = int((time.time() - start) * 1000)
        text = payload.get("response", f"{agent} completed the task.")

        results[agent] = {
            "output": text,
            "time": elapsed_ms,
            "tokens": "local",
            "cost": 0,
            "status": "completed"
        }

        if agent == "Writer":
            final_goal_output = text

    return {
        "source": "ollama-local",
        "agents": results,
        "goal_output": final_goal_output or f"Completed response for goal: {goal}",
        "workflow_summary": "Workflow completed through local Ollama."
    }

def run_template_agents(goal: str, mode: str):
    planner = (
        f"Planned execution for: {goal}\n"
        "1. Interpret the goal\n"
        "2. Break it into structured steps\n"
        "3. Gather context and assumptions\n"
        "4. Draft the deliverable\n"
        "5. Review and finalize"
    )

    research = (
        f"Context analysis for: {goal}\n"
        "- User likely expects a clear end result\n"
        "- Structured output improves trust\n"
        "- Orchestration reduces duplicated work"
    )

    writer = (
        f"Goal-achieved output for: {goal}\n\n"
        "Delivered result:\n"
        "- Clear interpretation of the objective\n"
        "- Structured execution path\n"
        "- Draft prepared from gathered context\n"
        "- Final answer aligned to user intent"
    )

    reviewer = (
        "Review complete.\n"
        "The output is aligned, structured, and easier to understand because separate agent roles were used."
    )

    results = {
        "Planner": {"output": planner, "time": 620, "tokens": "simulated", "cost": "N/A", "status": "completed"},
        "Research": {"output": research, "time": 710, "tokens": "simulated", "cost": "N/A", "status": "completed"},
        "Writer": {"output": writer, "time": 840, "tokens": "simulated", "cost": "N/A", "status": "completed"},
        "Reviewer": {"output": reviewer, "time": 540, "tokens": "simulated", "cost": "N/A", "status": "completed"},
    }

    return {
        "source": "template-fallback",
        "agents": results,
        "goal_output": writer,
        "workflow_summary": "Used hosted-safe template fallback because no AI provider was available."
    }