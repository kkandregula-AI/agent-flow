def run_openai_agents(goal: str, mode: str, api_key: str, source: str = "openai"):
    from openai import OpenAI
    import time

    client = OpenAI(api_key=api_key)

    prompts = {
        "Planner": f"You are the Planner Agent. Break this goal into execution steps.\nGoal: {goal}",
        "Research": f"You are the Research Agent. Gather context, assumptions, and risks.\nGoal: {goal}",
        "Writer": f"You are the Writer Agent. Produce a user-facing result.\nGoal: {goal}",
        "Reviewer": f"You are the Reviewer Agent. Review the result for completeness and clarity.\nGoal: {goal}",
    }

    agents = {}
    writer_output = ""

    for name, prompt in prompts.items():
        start = time.time()

        response = client.responses.create(
            model="gpt-4o-mini",
            input=prompt
        )

        text = getattr(response, "output_text", "") or f"{name} completed."
        usage = getattr(response, "usage", None)
        total_tokens = getattr(usage, "total_tokens", 0) if usage else 0

        agents[name] = {
            "output": text,
            "time": int((time.time() - start) * 1000),
            "tokens": total_tokens,
            "cost": round(total_tokens * 0.00001, 4),
            "status": "completed"
        }

        if name == "Writer":
            writer_output = text

    return {
        "source": source,
        "agents": agents,
        "goal_output": writer_output or f"Completed response for goal: {goal}",
        "workflow_summary": "Workflow completed successfully."
    }

# 🔻 ADD THIS AT THE END OF agents.py

def run_template_agents(goal: str, mode: str):
    return {
        "source": "template-fallback",
        "agents": {
            "Planner": {
                "output": f"Planned steps for: {goal}",
                "time": 600,
                "tokens": "simulated",
                "cost": "N/A",
                "status": "completed"
            },
            "Research": {
                "output": f"Gathered context and assumptions for: {goal}",
                "time": 700,
                "tokens": "simulated",
                "cost": "N/A",
                "status": "completed"
            },
            "Writer": {
                "output": f"Created a structured deliverable for: {goal}",
                "time": 850,
                "tokens": "simulated",
                "cost": "N/A",
                "status": "completed"
            },
            "Reviewer": {
                "output": "Validated that the output is aligned and complete.",
                "time": 500,
                "tokens": "simulated",
                "cost": "N/A",
                "status": "completed"
            }
        },
        "goal_output": f"Goal achieved for: {goal}",
        "workflow_summary": "Used template fallback."
    }