from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

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
    return {
        "result": {
            "Planner": {
                "output": f"Planned steps for: {req.goal}",
                "time": 600,
                "tokens": 120,
                "cost": 0.0012,
                "status": "completed"
            },
            "Research": {
                "output": f"Gathered context and assumptions for: {req.goal}",
                "time": 700,
                "tokens": 140,
                "cost": 0.0014,
                "status": "completed"
            },
            "Writer": {
                "output": f"Created a structured deliverable for: {req.goal}",
                "time": 850,
                "tokens": 180,
                "cost": 0.0018,
                "status": "completed"
            },
            "Reviewer": {
                "output": "Validated that the output is aligned and complete.",
                "time": 500,
                "tokens": 90,
                "cost": 0.0009,
                "status": "completed"
            }
        },
        "goal_output": f"Goal achieved for: {req.goal}",
        "explanation": (
            f'For the goal "{req.goal}", the system used {req.mode} orchestration. '
            f'The Planner structured the work, the Research agent gathered context, '
            f'the Writer created the user-facing output, and the Reviewer validated quality.'
        )
    }

app.mount("/", StaticFiles(directory="public", html=True), name="static")