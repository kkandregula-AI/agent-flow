from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from orchestrator import run_workflow
from explainer import explain_workflow

app = FastAPI()

class Request(BaseModel):
    goal: str
    api_key: str | None = None
    mode: str = "planner-first"

@app.post("/api/run")
async def run(req: Request):
    result = run_workflow(req.goal, req.api_key, req.mode)
    explanation = explain_workflow(req.goal)
    return {
        "result": result,
        "explanation": explanation
    }

app.mount("/", StaticFiles(directory="public", html=True), name="static")