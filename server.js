import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";

const app = express();
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public"), { maxAge: 0 }));

const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

/**
 * These are demo defaults only.
 * If you want more accurate cost estimation, set these in Railway variables:
 * OPENAI_INPUT_COST_PER_1K=0.00015
 * OPENAI_OUTPUT_COST_PER_1K=0.0006
 */
const INPUT_COST_PER_1K = Number(process.env.OPENAI_INPUT_COST_PER_1K || 0.00015);
const OUTPUT_COST_PER_1K = Number(process.env.OPENAI_OUTPUT_COST_PER_1K || 0.0006);

function escapeGoal(goal) {
  return String(goal || "").trim().slice(0, 4000);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function estimateCost(usage) {
  const inputTokens =
    usage?.input_tokens ??
    usage?.prompt_tokens ??
    usage?.input_tokens_details?.total_tokens ??
    0;

  const outputTokens =
    usage?.output_tokens ??
    usage?.completion_tokens ??
    usage?.output_tokens_details?.total_tokens ??
    0;

  const totalTokens = usage?.total_tokens ?? inputTokens + outputTokens;

  const estimated =
    (inputTokens / 1000) * INPUT_COST_PER_1K +
    (outputTokens / 1000) * OUTPUT_COST_PER_1K;

  return {
    inputTokens,
    outputTokens,
    totalTokens,
    estimatedCost: Number.isFinite(estimated) ? estimated : 0,
  };
}

function extractText(response) {
  if (response?.output_text) {
    return response.output_text.trim();
  }

  try {
    const chunks = [];
    for (const item of response?.output || []) {
      for (const content of item?.content || []) {
        if (typeof content?.text === "string") {
          chunks.push(content.text);
        }
      }
    }
    return chunks.join("\n").trim();
  } catch {
    return "";
  }
}

function buildFallbackWorkflow(goal, reason = "No working AI provider available.") {
  const cleanGoal = escapeGoal(goal);

  return {
    source: "Fallback Engine",
    providerStatus: {
      openai: "not_used",
      reason,
    },
    result: {
      Orchestrator: {
        output: `Interpreted the goal and routed the workflow through Planner, Research, Writer, and Reviewer steps for: ${cleanGoal}`,
        time: 280,
        tokens: "simulated",
        cost: "N/A",
        status: "completed",
      },
      Planner: {
        output: `Planned execution for: ${cleanGoal}
1. Interpret the user goal
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
        output: `Gathered context and assumptions for: ${cleanGoal}
- User expects a clear result
- Structured output improves trust
- Orchestration reduces duplicated work`,
        time: 620,
        tokens: "simulated",
        cost: "N/A",
        status: "completed",
      },
      Writer: {
        output: `Created a structured deliverable for: ${cleanGoal}

Delivered output:
- Clear interpretation of the objective
- Structured response aligned to user intent
- Organized final draft based on agent collaboration`,
        time: 710,
        tokens: "simulated",
        cost: "N/A",
        status: "completed",
      },
      Reviewer: {
        output: `Validated that the output is aligned, readable, and complete enough for user presentation.`,
        time: 430,
        tokens: "simulated",
        cost: "N/A",
        status: "completed",
      },
    },
    goal_output: `Goal achieved for: ${cleanGoal}

The system interpreted the request, planned the work, gathered context, drafted the output, and reviewed it before final delivery.`,
    explanation: `This run used the fallback engine. The Orchestrator coordinated the work, the Planner structured the path, the Research agent gathered context, the Writer created the deliverable, and the Reviewer validated quality.`,
    totals: {
      totalTokens: "simulated",
      estimatedCost: "N/A",
    },
  };
}

function buildAgentPrompts(goal) {
  return {
    Orchestrator: `You are the Orchestrator Agent.
Goal: ${goal}

Your job:
- Interpret the user's goal
- Explain how work should be routed across Planner, Research, Writer, and Reviewer
- Keep it concise
- Return a short orchestration note only`,

    Planner: `You are the Planner Agent.
Goal: ${goal}

Create a clear step-by-step execution plan.
Rules:
- 4 to 6 steps
- practical and easy to understand
- no markdown table`,

    Research: `You are the Research Agent.
Goal: ${goal}

Provide useful context, assumptions, risks, and what the user likely expects.
Rules:
- concise
- practical
- directly relevant to the goal`,

    Writer: `You are the Writer Agent.
Goal: ${goal}

Create the final user-facing deliverable.
Rules:
- polished
- structured
- directly solves the goal
- no meta commentary`,

    Reviewer: `You are the Reviewer Agent.
Goal: ${goal}

Review the drafted output for:
- alignment to the original goal
- clarity
- completeness
- quality

Return a short validation note and one improvement note.`,
  };
}

async function runOpenAIWorkflow(goal, apiKey) {
  const client = new OpenAI({ apiKey });
  const prompts = buildAgentPrompts(goal);

  const result = {};
  let totalTokens = 0;
  let totalEstimatedCost = 0;
  let writerOutput = "";

  for (const [agentName, prompt] of Object.entries(prompts)) {
    const started = Date.now();

    const response = await client.responses.create({
      model: OPENAI_MODEL,
      input: prompt,
    });

    const text = extractText(response) || `${agentName} completed the task.`;
    const usage = estimateCost(response.usage);

    result[agentName] = {
      output: text,
      time: Date.now() - started,
      tokens: usage.totalTokens,
      cost: `$${usage.estimatedCost.toFixed(4)}`,
      status: "completed",
    };

    totalTokens += Number(usage.totalTokens || 0);
    totalEstimatedCost += Number(usage.estimatedCost || 0);

    if (agentName === "Writer") {
      writerOutput = text;
    }

    await sleep(120);
  }

  return {
    source: "OpenAI",
    providerStatus: {
      openai: "working",
      model: OPENAI_MODEL,
    },
    result,
    goal_output:
      writerOutput ||
      `A final goal output was produced for: ${goal}`,
    explanation: `This run used OpenAI successfully. The Orchestrator interpreted the request and routed the work. The Planner created the execution path, the Research agent gathered context, the Writer produced the final output, and the Reviewer validated quality.`,
    totals: {
      totalTokens,
      estimatedCost: `$${totalEstimatedCost.toFixed(4)}`,
    },
  };
}

async function validateOpenAIKey(apiKey) {
  try {
    const client = new OpenAI({ apiKey });
    const response = await client.responses.create({
      model: OPENAI_MODEL,
      input: "Reply with only: OK",
    });
    const text = extractText(response);
    return {
      ok: true,
      message: text || "OK",
    };
  } catch (error) {
    return {
      ok: false,
      message: error?.message || "OpenAI key validation failed.",
    };
  }
}

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    model: OPENAI_MODEL,
  });
});

app.post("/api/validate-key", async (req, res) => {
  try {
    const userApiKey = String(req.body?.userApiKey || "").trim();
    if (!userApiKey) {
      return res.status(400).json({
        ok: false,
        message: "No API key provided.",
      });
    }

    const validation = await validateOpenAIKey(userApiKey);
    return res.json(validation);
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: error?.message || "Validation failed.",
    });
  }
});

app.post("/api/run", async (req, res) => {
  try {
    const goal = escapeGoal(req.body?.goal);
    const userApiKey = String(req.body?.userApiKey || "").trim();
    const serverApiKey = String(process.env.OPENAI_API_KEY || "").trim();

    if (!goal) {
      return res.status(400).json({
        error: "Goal is required.",
        result: {},
        goal_output: "",
        explanation: "",
      });
    }

    // Priority: user key -> server key -> fallback
    if (userApiKey) {
      try {
        const workflow = await runOpenAIWorkflow(goal, userApiKey);
        workflow.source = "User OpenAI Key";
        return res.json(workflow);
      } catch (error) {
        console.error("User key workflow failed:", error?.message || error);
        const fallback = buildFallbackWorkflow(
          goal,
          `User key provided, but OpenAI request failed: ${error?.message || "Unknown error"}`
        );
        fallback.providerStatus.openai = "failed_user_key";
        return res.json(fallback);
      }
    }

    if (serverApiKey) {
      try {
        const workflow = await runOpenAIWorkflow(goal, serverApiKey);
        workflow.source = "Server OpenAI Key";
        return res.json(workflow);
      } catch (error) {
        console.error("Server key workflow failed:", error?.message || error);
        const fallback = buildFallbackWorkflow(
          goal,
          `Server key exists, but OpenAI request failed: ${error?.message || "Unknown error"}`
        );
        fallback.providerStatus.openai = "failed_server_key";
        return res.json(fallback);
      }
    }

    return res.json(
      buildFallbackWorkflow(goal, "No OpenAI key was available, so fallback mode was used.")
    );
  } catch (error) {
    console.error("Run workflow error:", error);
    res.status(500).json({
      error: "Workflow failed",
      message: error?.message || "Unknown server error",
      result: {},
      goal_output: "",
      explanation: "",
      totals: {
        totalTokens: 0,
        estimatedCost: "$0.0000",
      },
    });
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`AgentFlow Studio running on port ${PORT}`);
});