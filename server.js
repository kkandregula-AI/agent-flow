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
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 12000);

const OPENAI_INPUT_COST_PER_1K = Number(process.env.OPENAI_INPUT_COST_PER_1K || 0.00015);
const OPENAI_OUTPUT_COST_PER_1K = Number(process.env.OPENAI_OUTPUT_COST_PER_1K || 0.0006);

function clean(value, max = 4000) {
  return String(value || "").trim().slice(0, max);
}

function buildFlowOrder(mode) {
  return ["Orchestrator", "Planner", "Research", "Writer", "Reviewer", "Goal Output"];
}

function styleInstruction(style) {
  const normalized = String(style || "balanced").toLowerCase();

  switch (normalized) {
    case "concise":
      return "Keep outputs short, clear, and compact.";
    case "detailed":
      return "Be detailed, structured, and informative.";
    case "executive":
      return "Use executive tone. Be polished and leadership-friendly.";
    case "balanced":
    default:
      return "Be balanced. Keep outputs practical and moderately detailed.";
  }
}

function buildFallbackWorkflow(goal, mode, instructionStyle, reason = "Fallback mode was used.") {
  const cleanGoal = clean(goal);
  const flowOrder = buildFlowOrder(mode);

  const result = {
    Orchestrator: {
      output: `The orchestrator interpreted the goal, selected ${mode} orchestration, and routed work across Planner, Research, Writer, and Reviewer.`,
      time: 220,
      tokens: "simulated",
      cost: "N/A",
      status: "completed",
    },
    Planner: {
      output: `Execution plan for: ${cleanGoal}
1. Interpret the goal
2. Break it into structured steps
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
- The user expects a visible end result
- Structure increases trust
- Review keeps the final answer aligned`,
      time: 560,
      tokens: "simulated",
      cost: "N/A",
      status: "completed",
    },
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
    shared_memory: {
      execution_context: `Goal: ${cleanGoal}`,
      task_graph: flowOrder.join(" → "),
      planner_output: result.Planner.output,
      research_output: result.Research.output,
      reviewer_notes: result.Reviewer.output,
      final_synthesis: result.Orchestrator.output,
    },
    goal_output: `Goal achieved for: ${cleanGoal}

The system interpreted the request, planned the work, gathered context, drafted the output, and reviewed it before final delivery.`,
    explanation: `This run used the template fallback. The orchestrator coordinated the workflow, the Planner structured the path, the Research agent gathered context, the Writer produced the user-facing result, and the Reviewer validated quality.`,
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

async function callOpenAI(prompt, apiKey) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

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
      throw new Error(payload?.error?.message || `OpenAI failed with ${response.status}`);
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

async function buildOpenAIWorkflow(goal, apiKey, mode, instructionStyle) {
  const prompt = `
You are a multi-agent workflow simulator.

User goal:
${goal}

Orchestration mode:
${mode}

Instruction style:
${instructionStyle}

Style rule:
${styleInstruction(instructionStyle)}

Return STRICT JSON only with this exact shape:

{
  "orchestrator": "string",
  "planner": "string",
  "research": "string",
  "writer": "string",
  "reviewer": "string",
  "goal_output": "string",
  "explanation": "string"
}

Requirements:
- "orchestrator": explain how the workflow is routed
- "planner": 4 to 6 numbered steps
- "research": assumptions, context, risks
- "writer": final user-facing deliverable
- "reviewer": short validation note and one improvement note
- "goal_output": concise final outcome for the user
- "explanation": explain what happened in the multi-agent workflow
- no markdown
- no code fences
- valid JSON only
`.trim();

  const payload = await callOpenAI(prompt, apiKey);
  const rawText = extractResponseText(payload);

  if (!rawText) {
    throw new Error("OpenAI returned no text.");
  }

  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error("OpenAI did not return valid JSON.");
  }

  const usage = estimateOpenAICost(payload?.usage || {});
  const flowOrder = buildFlowOrder(mode);

  const result = {
    Orchestrator: {
      output: parsed.orchestrator || "No orchestrator output returned.",
      time: 500,
      tokens: usage.totalTokens,
      cost: `$${usage.estimatedCost.toFixed(4)}`,
      status: "completed",
    },
    Planner: {
      output: parsed.planner || "No planner output returned.",
      time: 500,
      tokens: usage.totalTokens,
      cost: `$${usage.estimatedCost.toFixed(4)}`,
      status: "completed",
    },
    Research: {
      output: parsed.research || "No research output returned.",
      time: 500,
      tokens: usage.totalTokens,
      cost: `$${usage.estimatedCost.toFixed(4)}`,
      status: "completed",
    },
    Writer: {
      output: parsed.writer || "No writer output returned.",
      time: 500,
      tokens: usage.totalTokens,
      cost: `$${usage.estimatedCost.toFixed(4)}`,
      status: "completed",
    },
    Reviewer: {
      output: parsed.reviewer || "No reviewer output returned.",
      time: 500,
      tokens: usage.totalTokens,
      cost: `$${usage.estimatedCost.toFixed(4)}`,
      status: "completed",
    },
  };

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
    shared_memory: {
      execution_context: `Goal: ${goal}`,
      task_graph: flowOrder.join(" → "),
      planner_output: result.Planner.output,
      research_output: result.Research.output,
      reviewer_notes: result.Reviewer.output,
      final_synthesis: result.Orchestrator.output,
    },
    goal_output: parsed.goal_output || parsed.writer || `Goal output generated for: ${goal}`,
    explanation: parsed.explanation || "OpenAI generated a multi-agent workflow response.",
    totals: {
      totalTokens: usage.totalTokens,
      estimatedCost: `$${usage.estimatedCost.toFixed(4)}`,
    },
  };
}

async function validateOpenAIKey(apiKey) {
  try {
    const payload = await callOpenAI("Reply with only: OK", apiKey);
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
    requestTimeoutMs: REQUEST_TIMEOUT_MS,
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

    const payload = await callOpenAI("Reply with only: OPENAI_OK", serverOpenAIKey);

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

    const apiKeyToUse = userApiKey || serverOpenAIKey;

    if (!apiKeyToUse) {
      return res.json(
        buildFallbackWorkflow(
          goal,
          mode,
          instructionStyle,
          "No OpenAI key was available, so template fallback was used."
        )
      );
    }

    const workflowPromise = buildOpenAIWorkflow(goal, apiKeyToUse, mode, instructionStyle);

    const timeoutFallbackPromise = new Promise((resolve) => {
      setTimeout(() => {
        resolve(
          buildFallbackWorkflow(
            goal,
            mode,
            instructionStyle,
            `OpenAI workflow exceeded ${REQUEST_TIMEOUT_MS} ms, so template fallback was used.`
          )
        );
      }, REQUEST_TIMEOUT_MS + 1000);
    });

    const workflow = await Promise.race([workflowPromise, timeoutFallbackPromise]);

    if (userApiKey && workflow.source === "OpenAI") {
      workflow.source = "User OpenAI Key";
    } else if (serverOpenAIKey && workflow.source === "OpenAI") {
      workflow.source = "Server OpenAI Key";
    }

    return res.json(workflow);
  } catch (error) {
    console.error("Run workflow error:", error);
    return res.json(
      buildFallbackWorkflow(
        "Workflow request",
        "planner-first",
        "balanced",
        `Server error: ${error?.message || "Unknown error"}. Template fallback was used.`
      )
    );
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`AgentFlow Studio running on port ${PORT}`);
});