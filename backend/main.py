from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from orchestrator import run_workflow

app = FastAPI()


class Request(BaseModel):
    goal: str
    api_key: str | None = None
    mode: str = "planner-first"


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/run")
async def run(req: Request):
    workflow = run_workflow(req.goal, req.api_key, req.mode)

    source = workflow.get("source", "unknown")
    agents = workflow.get("agents", {})
    goal_output = workflow.get("goal_output", "")
    workflow_summary = workflow.get("workflow_summary", "")

    explanation = (
        f'For the goal "{req.goal}", the system used {req.mode} orchestration. '
        f'The Planner structured the work, the Research agent gathered context, '
        f'the Writer created the user-facing output, and the Reviewer validated quality. '
        f'Current AI source: {source}.'
    )

    return {
        "source": source,
        "result": agents,
        "goal_output": goal_output,
        "workflow_summary": workflow_summary,
        "explanation": explanation
    }


app.mount("/", StaticFiles(directory="public", html=True), name="static")