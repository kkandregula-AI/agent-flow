from agents import run_agent

AGENTS = ["Planner", "Research", "Writer", "Reviewer"]

def run_workflow(goal, api_key, mode):
    results = {}

    for agent in AGENTS:
        output = run_agent(agent, goal, api_key)

        results[agent] = output

    return results