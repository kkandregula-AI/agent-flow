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

// Estimated pricing placeholders for display only.
// Override these in Railway variables if you want different values.
const OPENAI_INPUT_COST_PER_1K = Number(process.env.OPENAI_INPUT_COST_PER_1K || 0.00015);
const OPENAI_OUTPUT_COST_PER_1K = Number(process.env.OPENAI_OUTPUT_COST_PER_1K || 0.0006);

function clean(value, max = 4000) {
  return String(value || "").trim().slice(0, max);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractOpenAIText(response) {
  if (response?.output_text) return response.output_text.trim();

  try {
    const parts = [];
    for (const item of response?.output || []) {
      for (const content of item?.content || []) {
        if (typeof content?.text === "string") {
          parts.push(content.text);
        }
      }
    }
    return parts.join("\n").trim();
  } catch {
    return "";
  }
}

function estimateOpenAIUsage(usage) {
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

  const totalTokens = usage?.total_tokens ?? (inputTokens + outputTokens);

  const estimatedCost =
    (inputTokens / 1000) * OPENAI_INPUT_COST_PER_1K +
    (outputTokens / 1000) * OPENAI_OUTPUT_COST_PER_1K;

  return {
    inputTokens,
    outputTokens,
    totalTokens,
    estimatedCost,
  };
}

function buildFlowOrder(mode) {
  const normalized = String(mode || "planner-first").toLowerCase();

  switch (normalized) {
    case "sequential":
      return ["Orchestrator", "Planner", "Research", "Writer", "Reviewer", "Goal Output"];
    case "parallel":
      return ["Orchestrator", "Planner", "Research", "Writer", "Reviewer", "Goal Output"];
    case "debate":
      return ["Orchestrator", "Planner", "Research", "Writer", "Reviewer", "Goal Output"];
    case "planner-first":
    default:
      return ["Orchestrator", "Planner", "Research", "Writer", "Reviewer", "Goal Output"];
  }
}

function styleInstruction(style) {
  const normalized = String(style || "balanced").toLowerCase();

  switch (normalized) {
    case "concise":
      return "Be concise. Keep outputs short, clear, and compact.";
    case "detailed":
      return "Be detailed. Add useful context, stronger structure, and richer explanation.";
    case "executive":
      return "Use executive tone. Make the output polished, strategic, and leadership-friendly.";
    case "balanced":
    default:
      return "Be balanced. Keep outputs clear, practical, and moderately detailed.";
  }
}

function buildPrompts(goal, mode, instructionStyle) {
  const styleRule = styleInstruction(instructionStyle);
  const modeLabel = String(mode || "planner-first");

  return {
    Orchestrator: `
You are the Orchestrator Agent in a multi-agent system.

Goal:
${goal}

Mode:
${modeLabel}

Instruction style:
${instructionStyle}

${styleRule}

Your job:
- interpret the user's goal
- explain which agents should act and in what pattern
- describe the workflow in 3 to 5 lines
- mention why this mode is suitable

Do not produce the final deliverable.
`.trim(),

    Planner: `
You are the Planner Agent.

Goal:
${goal}

Mode:
${modeLabel}

Instruction style:
${instructionStyle}

${styleRule}

Create a practical execution plan:
- 4 to 6 steps
- simple numbered format
- specific to the user's goal
`.trim(),

    Research: `
You are the Research Agent.

Goal:
${goal}

Mode:
${modeLabel}

Instruction style:
${instructionStyle}

${styleRule}

Provide:
- user intent
- assumptions
- risks
- context that will help the Writer

Keep it relevant and practical.
`.trim(),

    Writer: `
You are the Writer Agent.

Goal:
${goal}

Mode:
${modeLabel}

Instruction style:
${instructionStyle}

${styleRule}

Create the final user-facing deliverable.
It should directly solve the user's goal.
No meta commentary.
`.trim(),

    Reviewer: `
You are the Reviewer Agent.

Goal:
${goal}

Mode:
${modeLabel}

Instruction style:
${instructionStyle}

${styleRule}

Review the drafted output for:
- alignment to original goal
- clarity
- completeness
- quality

Return:
- short validation note
- one improvement note.
`.trim(),
  };
}

function buildSharedMemory(goal, flowOrder, result, providerLabel) {
  return {
    execution_context: `Goal: ${goal}`,
    task_graph: flowOrder.join(" → "),
    planner_output: result.Planner?.output || "",
    research_output: result.Research?.output || "",
    reviewer_notes: result.Reviewer?.output || "",
    final_synthesis:
      result.Orchestrator?.output ||
      `Workflow completed with ${providerLabel}.`,
  };
}

function buildFallbackWorkflow(goal, mode, instructionStyle, reason = "Fallback mode was used.") {
  const cleanGoal = clean(goal);
  const flowOrder = buildFlowOrder(mode);

  const result = {
    Orchestrator: {
      output: `The orchestrator interpreted the goal, selected ${mode} orchestration, and routed work across Planner, Research, Writer, and Reviewer.`,
      time: 240,
      tokens: "simulated",
      cost: "N/A",
      status: "completed",
    },
    Planner: {
      output: `Execution plan for: ${cleanGoal}
1. Interpret the goal clearly
2. Break work into structured steps
3. Gather context and assumptions
4. Draft the user-facing deliverable
5. Review and refine before final output`,
      time: 520,
      tokens: "simulated",
      cost: "N/A",
      status: "completed",
    },
    Research: {
      output: `Context for: ${cleanGoal}
- The user expects a visible end result
- Structure increases trust and readability
- Agent separation reduces duplicated work
- Review step helps keep the final answer aligned`,
      time: 610,
      tokens: "simulated",
      cost: "N/A",
      status: "completed",
    },
    Writer: {
      output: `Created a structured deliverable for: ${cleanGoal}

Delivered result:
- Clear interpretation of the request
- Organized output aligned to user intent
- Draft informed by research and plan
- Ready for review and final delivery`,
      time: 760,
      tokens: "simulated",
      cost: "N/A",
      status: "completed",
    },
    Reviewer: {
      output: `Validation complete.
The output is aligned, structured, and understandable.
Improvement note: if a live model is available, the system can generate more specific content.`,
      time: 430,
      tokens: "simulated",
      cost: "N/A",
      status: "completed",
    },
  };

  return {
    source: "Template Fallback",
    providerStatus: {
      openai: "not_used",
      reason,
    },
    meta: {
      mode,
      instructionStyle,
      flowOrder,
    },
    result,
    shared_memory: buildSharedMemory(cleanGoal, flowOrder, result, "template fallback"),
    goal_output: `Goal achieved for: ${cleanGoal}

The system interpreted the request, planned the work, gathered context, drafted the output, and reviewed it before final delivery.`,
    explanation: `This run used the template fallback. The orchestrator coordinated the workflow, the Planner structured the path, the Research agent gathered context, the Writer produced the user-facing result, and the Reviewer validated quality.`,
    totals: {
      totalTokens: "simulated",
      estimatedCost: "N/A",
    },
  };
}

async function runOpenAIWorkflow(goal, apiKey, mode, instructionStyle) {
  const client = new OpenAI({ apiKey });
  const prompts = buildPrompts(goal, mode, instructionStyle);
  const flowOrder = buildFlowOrder(mode);

  const result = {};
  let totalTokens = 0;
  let totalEstimatedCost = 0;

  for (const [agentName, prompt] of Object.entries(prompts)) {
    const started = Date.now();

    const response = await client.responses.create({
      model: OPENAI_MODEL,
      input: prompt,
    });

    const text = extractOpenAIText(response) || `${agentName} completed the task.`;
    const usage = estimateOpenAIUsage(response.usage);

    result[agentName] = {
      output: text,
      time: Date.now() - started,
      tokens: usage.totalTokens,
      cost: `$${usage.estimatedCost.toFixed(4)}`,
      status: "completed",
    };

    totalTokens += Number(usage.totalTokens || 0);
    totalEstimatedCost += Number(usage.estimatedCost || 0);

    await sleep(120);
  }

  return {
    source: "OpenAI",
    providerStatus: {
      openai: "working",
      model: OPENAI_MODEL,
    },
    meta: {
      mode,
      instructionStyle,
      flowOrder,
    },
    result,
    shared_memory: buildSharedMemory(goal, flowOrder, result, "OpenAI"),
    goal_output:
      result.Writer?.output ||
      `A final goal output was produced for: ${goal}`,
    explanation: `This run used OpenAI successfully. The orchestrator routed work using ${mode} mode with ${instructionStyle} instruction style. The Planner defined the path, the Research agent gathered context, the Writer created the deliverable, and the Reviewer validated it.`,
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
    const text = extractOpenAIText(response);
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
    openaiModel: OPENAI_MODEL,
  });
});

app.post("/api/validate-key", async (req, res) => {
  try {
    const userApiKey = clean(req.body?.userApiKey || "", 1000);
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
    const goal = clean(req.body?.goal);
    const userApiKey = clean(req.body?.userApiKey || "", 1000);
    const mode = clean(req.body?.mode || "planner-first", 50).toLowerCase();
    const instructionStyle = clean(req.body?.instructionStyle || "balanced", 50).toLowerCase();

    const serverOpenAIKey = clean(process.env.OPENAI_API_KEY || "", 1000);

    if (!goal) {
      return res.status(400).json({
        error: "Goal is required.",
        result: {},
        shared_memory: {},
        goal_output: "",
        explanation: "",
      });
    }

    if (userApiKey) {
      try {
        const workflow = await runOpenAIWorkflow(goal, userApiKey, mode, instructionStyle);
        workflow.source = "User OpenAI Key";
        return res.json(workflow);
      } catch (error) {
        console.error("User OpenAI workflow failed:", error?.message || error);

        return res.json(
          buildFallbackWorkflow(
            goal,
            mode,
            instructionStyle,
            `User OpenAI key failed: ${error?.message || "Unknown error"}. Template fallback was used.`
          )
        );
      }
    }

    if (serverOpenAIKey) {
      try {
        const workflow = await runOpenAIWorkflow(goal, serverOpenAIKey, mode, instructionStyle);
        workflow.source = "Server OpenAI Key";
        return res.json(workflow);
      } catch (error) {
        console.error("Server OpenAI workflow failed:", error?.message || error);

        return res.json(
          buildFallbackWorkflow(
            goal,
            mode,
            instructionStyle,
            `Server OpenAI key failed: ${error?.message || "Unknown error"}. Template fallback was used.`
          )
        );
      }
    }

    return res.json(
      buildFallbackWorkflow(
        goal,
        mode,
        instructionStyle,
        "No OpenAI key was available, so template fallback was used."
      )
    );
  } catch (error) {
    console.error("Run workflow error:", error);
    res.status(500).json({
      error: "Workflow failed",
      message: error?.message || "Unknown server error",
      result: {},
      shared_memory: {},
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