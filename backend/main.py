from fastapi import FastAPI
from pydantic import BaseModel
from orchestrator import run_workflow
from explainer import explain_workflow

# ✅ CREATE APP FIRST
app = FastAPI()

# ✅ ROOT ROUTE
@app.get("/")
def home():
    return {"message": "AgentFlow Backend is running 🚀"}

# ✅ REQUEST MODEL
class Request(BaseModel):
    goal: str
    api_key: str | None = None
    mode: str = "planner-first"

# ✅ MAIN API
@app.post("/api/run")
async def run(req: Request):
    result = run_workflow(req.goal, req.api_key, req.mode)
    explanation = explain_workflow(req.goal)

    return {
        "result": result,
        "explanation": explanation
    }