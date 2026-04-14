import requests
import time

OLLAMA_URL = "http://localhost:11434/api/generate"

def call_ollama(prompt):
    try:
        res = requests.post(OLLAMA_URL, json={
            "model": "llama3",
            "prompt": prompt,
            "stream": False
        })
        return res.json()["response"]
    except:
        return "Ollama not running"

def run_agent(agent, goal, api_key=None):
    start = time.time()

    prompt = f"{agent} Agent working on: {goal}"

    output = call_ollama(prompt)

    return {
        "output": output,
        "time": int((time.time() - start) * 1000),
        "tokens": "local",
        "cost": "0"
    }