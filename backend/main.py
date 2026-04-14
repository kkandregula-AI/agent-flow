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

    return {
        "result": workflow.get("agents", {}),  # 👈 THIS IS CRITICAL
        "goal_output": workflow.get("goal_output", ""),
        "explanation": explain_workflow(
            req.goal,
            req.mode,
            workflow.get("source", "unknown")
        )
    }
app.mount("/", StaticFiles(directory="public", html=True), name="static")