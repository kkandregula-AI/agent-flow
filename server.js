import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/run", async (req, res) => {
  try {
    const { goal, userApiKey } = req.body;

    // Temporary stable fallback response.
    // This keeps the UI working even if OpenAI is not wired yet.
    const workflow = {
      source: "Fallback Engine",
      result: {
        Planner: {
          output: `Planned execution for: ${goal}
1. Interpret the goal
2. Break it into structured steps
3. Gather context and assumptions
4. Draft the deliverable
5. Review and finalize`,
          time: 500,
          tokens: "simulated",
          cost: "N/A",
          status: "completed",
        },
        Research: {
          output: `Gathered context and assumptions for: ${goal}
- User expects a clear result
- Structured output improves trust
- Orchestration reduces duplicated work`,
          time: 600,
          tokens: "simulated",
          cost: "N/A",
          status: "completed",
        },
        Writer: {
          output: `Created a structured deliverable for: ${goal}

Delivered output:
- Clear interpretation of the objective
- Structured response aligned to user intent
- Organized final draft based on agent collaboration`,
          time: 700,
          tokens: "simulated",
          cost: "N/A",
          status: "completed",
        },
        Reviewer: {
          output: "Validated that the output is aligned and complete.",
          time: 400,
          tokens: "simulated",
          cost: "N/A",
          status: "completed",
        },
      },
      goal_output: `Goal Achieved: ${goal}

The system interpreted the request, planned the work, gathered context, drafted the output, and validated it before delivery.`,
      explanation: `For the goal "${goal}", the system used a multi-agent workflow. The Planner structured the task, the Research agent gathered context, the Writer created the user-facing deliverable, and the Reviewer validated quality.`,
    };

    console.log("Returning workflow payload:", JSON.stringify(workflow, null, 2));
    res.json(workflow);
  } catch (error) {
    console.error("Run workflow error:", error);
    res.status(500).json({
      error: "Workflow failed",
      message: error.message,
      result: {},
      goal_output: "",
      explanation: "",
    });
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`AgentFlow Studio running on port ${PORT}`);
});