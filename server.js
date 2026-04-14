import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public"), { maxAge: 0 }));

const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const AGENT_TIMEOUT_MS = Number(process.env.AGENT_TIMEOUT_MS || 15000);
const USE_FAST_AGENT_SET = String(process.env.USE_FAST_AGENT_SET || "true").toLowerCase() === "true";

const OPENAI_INPUT_COST_PER_1K = Number(process.env.OPENAI_INPUT_COST_PER_1K || 0.00015);
const OPENAI_OUTPUT_COST_PER_1K = Number(process.env.OPENAI_OUTPUT_COST_PER_1K || 0.0006);

function clean(value, max = 4000) {
  return String(value || "").trim().slice(0, max);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildFlowOrder(mode, fastMode = true) {
  if (fastMode) {
    return ["Orchestrator", "Writer", "Reviewer", "Goal Output"];
  }
  return ["Orchestrator", "Planner", "Research", "Writer", "Reviewer", "Goal Output"];
}

function styleInstruction(style) {
  const normalized = String(style || "balanced").toLowerCase();

  switch (normalized) {
    case "concise":
      return "Be concise. Keep outputs short, clear, and compact.";
    case "detailed":
      return "Be detailed. Add useful context and stronger structure.";
    case "executive":
      return "Use executive tone. Make the output polished and leadership-friendly.";
    case "balanced":
    default:
      return "Be balanced. Keep outputs clear, practical, and moderately detailed.";
  }
}

function buildPrompts(goal, mode, instructionStyle, fastMode = true) {
  const styleRule = styleInstruction(instructionStyle);
  const modeLabel = String(mode || "planner-first");

  if (fastMode) {
    return {
      Orchestrator: `
You are the Orchestrator Agent.

Goal:
${goal}

Mode:
${modeLabel}

Instruction style:
${instructionStyle}

${styleRule}

Explain:
- what the system is trying to achieve
- why this mode is suitable
- how work is handed to the next agents

Keep it short and practical.
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

Review the final deliverable for:
- alignment to original goal
- clarity
- completeness
- quality

Return:
- short validation note
- one improvement note
`.trim(),
    };
  }

  return {
    Orchestrator: `
You are the Orchestrator Agent.

Goal:
${goal}

Mode:
${modeLabel}

Instruction style:
${instructionStyle}

${styleRule}

Explain the workflow in 3 to 5 lines.
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
- numbered format
- specific to the goal
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
- useful context
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
- alignment
- clarity
- completeness
- quality

Return:
- short validation note
- one improvement note
`.trim(),
  };
}

function buildSharedMemory(goal, flowOrder, result, providerLabel) {
  return {
    execution_context: `Goal: ${goal}`,
    task_graph: flowOrder.join(" → "),
    planner_output: result.Planner?.output || "Planner step omitted in fast mode.",
    research_output: result.Research?.output || "Research step omitted in fast mode.",
    reviewer_notes: result.Reviewer?.output || "",
    final_synthesis: result.Orchestrator?.output || `Workflow completed with ${providerLabel}.`,
  };
}

function buildFallbackWorkflow(goal, mode, instructionStyle, reason = "Fallback mode was used.") {
  const cleanGoal = clean(goal);
  const flowOrder = buildFlowOrder(mode, USE_FAST_AGENT_SET);

  const result = {
    Orchestrator: {
      output: `The orchestrator interpreted the goal, selected ${mode} orchestration, and routed work toward final delivery.`,
      time: 220,
      tokens: "simulated",
      cost: "N/A",
      status: "completed",
    },
    ...(USE_FAST_AGENT_SET
      ? {}
      : {
          Planner: {
            output: `Execution plan for: ${cleanGoal}
1. Interpret the goal clearly
2. Break work into structured steps
3. Gather context and assumptions
4. Draft the user-facing deliverable
5. Review and refine`,
            time: 480,
            tokens: "simulated",
            cost: "N/A",
            status: "completed",
          },
          Research: {
            output: `Context for: ${cleanGoal}
- User expects a visible end result
- Structure increases trust
- Review keeps the answer aligned`,
            time: 560,
            tokens: "simulated",
            cost: "N/A",
            status: "completed",
          },
        }),
    Writer: {
      output: `Created a structured deliverable for: ${cleanGoal}

Delivered result:
- Clear interpretation of the request
- Organized output aligned to user intent
- Draft informed by orchestration and context`,
      time: 690,
      tokens: "simulated",
      cost: "N/A",
      status: "completed",
    },
    Reviewer: {
      output: `Validation complete.
The output is aligned, structured, and understandable.`,
      time: 390,
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

The system interpreted the request, drafted the output, and reviewed it before final delivery.`,
    explanation: `This run used the template fallback. The orchestrator coordinated the workflow, the Writer produced the user-facing result, and the Reviewer validated quality.`,
    totals: {
      totalTokens: "simulated",
      estimatedCost: "N/A",
    },
  };
}

function estimateOpenAICost(usage) {
  const inputTokens = usage?.input_tokens || 0;
  const outputTokens = usage?.output_tokens || 0;
  const totalTokens = usage?.total_tokens || inputTokens + outputTokens;

  const estimatedCost =
    (inputTokens / 1000) * OPENAI_INPUT_COST_PER_1K +
    (outputTokens / 1000) * OPENAI_OUTPUT_COST_PER_1K;

  return {
    totalTokens,
    estimatedCost,
  };
}

async function callOpenAI(prompt, apiKey, label) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AGENT_TIMEOUT_MS);

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        input: prompt,
      }),
      signal: controller.signal,
    });

    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload?.error?.message || `${label} failed with ${response.status}`);
    }

    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

function extractResponseText(payload) {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  try {
    const parts = [];
    for (const item of payload?.output || []) {
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

async function runOpenAIWorkflow(goal, apiKey, mode, instructionStyle) {
  const prompts = buildPrompts(goal, mode, instructionStyle, USE_FAST_AGENT_SET);
  const flowOrder = buildFlowOrder(mode, USE_FAST_AGENT_SET);

  const result = {};
  let totalTokens = 0;
  let totalEstimatedCost = 0;

  for (const [agentName, prompt] of Object.entries(prompts)) {
    const started = Date.now();

    const payload = await callOpenAI(prompt, apiKey, `OpenAI ${agentName}`);
    const text = extractResponseText(payload) || `${agentName} completed the task.`;
    const usage = estimateOpenAICost(payload?.usage || {});

    result[agentName] = {
      output: text,
      time: Date.now() - started,
      tokens: usage.totalTokens,
      cost: `$${usage.estimatedCost.toFixed(4)}`,
      status: "completed",
    };

    totalTokens += Number(usage.totalTokens || 0);
    totalEstimatedCost += Number(usage.estimatedCost || 0);

    await sleep(100);
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
    goal_output: result.Writer?.output || `A final goal output was produced for: ${goal}`,
    explanation: `This run used OpenAI successfully. The orchestrator routed work using ${mode} mode with ${instructionStyle} instruction style. The Writer created the deliverable, and the Reviewer validated it.`,
    totals: {
      totalTokens,
      estimatedCost: `$${totalEstimatedCost.toFixed(4)}`,
    },
  };
}

async function validateOpenAIKey(apiKey) {
  try {
    const payload = await callOpenAI("Reply with only: OK", apiKey, "OpenAI validation");
    const text = extractResponseText(payload);
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
    fastMode: USE_FAST_AGENT_SET,
    agentTimeoutMs: AGENT_TIMEOUT_MS,
  });
});

app.get("/api/test-openai", async (req, res) => {
  try {
    const serverOpenAIKey = clean(process.env.OPENAI_API_KEY || "", 1000);

    if (!serverOpenAIKey) {
      return res.status(400).json({
        ok: false,
        message: "No OPENAI_API_KEY found in environment.",
      });
    }

    const payload = await callOpenAI("Reply with only: OPENAI_OK", serverOpenAIKey, "OpenAI test");
    return res.json({
      ok: true,
      reply: extractResponseText(payload),
      usage: payload?.usage || {},
      model: OPENAI_MODEL,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: error.message,
    });
  }
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