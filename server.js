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
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 25000);

const OPENAI_INPUT_COST_PER_1K = Number(process.env.OPENAI_INPUT_COST_PER_1K || 0.00015);
const OPENAI_OUTPUT_COST_PER_1K = Number(process.env.OPENAI_OUTPUT_COST_PER_1K || 0.0006);

function clean(value, max = 6000) {
  return String(value || "").trim().slice(0, max);
}

function buildFlowOrder(mode) {
  return ["Orchestrator", "Planner", "Research", "Writer", "Reviewer", "Goal Output"];
}

function styleInstruction(style) {
  const normalized = String(style || "balanced").toLowerCase();

  switch (normalized) {
    case "concise":
      return "Keep the response short, direct, and compact.";
    case "detailed":
      return "Be detailed, structured, and comprehensive.";
    case "executive":
      return "Use polished executive tone suitable for leadership and stakeholders.";
    case "balanced":
    default:
      return "Be clear, practical, and moderately detailed.";
  }
}

function isMultiAgentEligible(goal) {
  const text = clean(goal, 1200).toLowerCase();

  const strongSignals = [
    "prd",
    "product requirement",
    "requirements document",
    "gtm",
    "go to market",
    "roadmap",
    "strategy",
    "feature spec",
    "specification",
    "compare",
    "comparison",
    "trade-off",
    "tradeoff",
    "analyze",
    "analysis",
    "research",
    "framework",
    "workflow",
    "plan",
    "architecture",
    "proposal",
    "business case",
    "metrics",
    "risks",
    "user stories",
    "functional requirements"
  ];

  const simpleSignals = [
    "rewrite",
    "rephrase",
    "translate",
    "summarize",
    "summary",
    "explain",
    "meaning",
    "tagline",
    "caption",
    "bio",
    "one line",
    "two lines",
    "three lines",
    "short answer",
    "good english"
  ];

  const strongMatches = strongSignals.filter(s => text.includes(s)).length;
  const simpleMatches = simpleSignals.filter(s => text.includes(s)).length;

  const wordCount = text.split(/\s+/).filter(Boolean).length;

  if (strongMatches >= 1) return true;
  if (simpleMatches >= 1 && strongMatches === 0) return false;
  if (wordCount >= 18) return true;

  return false;
}

function buildSingleAgentPrompt(goal, instructionStyle) {
  return `
You are a strong single-agent assistant.

User goal:
${goal}

Style rule:
${styleInstruction(instructionStyle)}

Return STRICT JSON only with this exact shape:

{
  "answer": "string",
  "explanation": "string"
}

Requirements:
- "answer" should directly solve the user request
- "explanation" should briefly explain why single-agent execution was sufficient
- no markdown code fences
- valid JSON only
`.trim();
}

function buildMultiAgentPrompt(goal, mode, instructionStyle) {
  return `
You are a multi-agent workflow simulator that must produce output in a polished ChatGPT-style format.

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
- "planner": 4 to 6 numbered planning steps
- "research": user intent, assumptions, risks, and useful context
- "writer": produce the final user-facing deliverable
- "reviewer": validate the output and suggest one improvement
- "goal_output": must contain the final main output, not just a summary
- "explanation": explain what happened in the multi-agent workflow
- no markdown code fences
- valid JSON only

If the user asks for a PRD, make "writer" and "goal_output" a real PRD with headings such as:
- Product Title
- Product Overview
- Problem Statement
- Target Users
- Goals
- Non-Goals
- Core Features
- User Stories
- Functional Requirements
- Success Metrics
- Risks and Considerations
- Future Enhancements
`.trim();
}

function buildFallbackMultiAgentWorkflow(goal, mode, instructionStyle, reason = "Fallback mode was used.") {
  const cleanGoal = clean(goal);
  const flowOrder = buildFlowOrder(mode);

  const prd = `# Product Requirements Document
## Product Title
Privacy-First Expense Tracker

## 1. Product Overview
The Privacy-First Expense Tracker is a personal finance application designed to help users record, categorize, and review daily expenses while keeping their financial data private and secure.

## 2. Problem Statement
Many users want simple expense tracking tools but are concerned about sharing financial data with third-party cloud services. Existing solutions often prioritize connectivity over privacy.

## 3. Target Users
- Privacy-conscious individuals
- Families managing household budgets
- Users who want simple manual expense tracking
- People who prefer local-first financial tools

## 4. Goals
- Enable users to quickly record and categorize expenses
- Provide clear summaries and trends
- Preserve user privacy through local-first or privacy-first design
- Keep the interface simple and lightweight

## 5. Non-Goals
- Full accounting software
- Tax filing support
- Investment advisory features
- Complex enterprise reporting

## 6. Core Features
- Add, edit, and delete expenses
- Expense categories
- Daily, weekly, and monthly summaries
- Search and filter transactions
- Privacy-first storage model
- Export user data

## 7. User Stories
- As a user, I want to add an expense quickly so that I can track spending in real time.
- As a user, I want to categorize expenses so that I can understand spending patterns.
- As a user, I want my financial data to remain private so that I feel safe using the product.
- As a user, I want monthly summaries so that I can manage my budget more effectively.

## 8. Functional Requirements
- The system must allow manual expense entry.
- The system must support category-based classification.
- The system must display summaries by selected time range.
- The system must allow editing and deleting existing records.
- The system must support exporting stored expense data.
- The system should prioritize local or privacy-preserving storage.

## 9. Success Metrics
- Daily active usage
- Number of expenses logged per user
- Weekly retention
- Percentage of users who use summaries
- Export usage rate

## 10. Risks and Considerations
- Users may expect automatic bank integration
- Privacy claims must be clearly explained
- Local-only storage may create backup concerns
- Simplicity must be balanced with usefulness

## 11. Future Enhancements
- Shared family budgets
- Recurring expense reminders
- Budget goal tracking
- Better visualization dashboards
- Optional secure backup features`;

  const genericOutput = `Structured output for: ${cleanGoal}

1. Objective
2. Context
3. Recommended approach
4. Risks or caveats
5. Final recommendation`;

  const finalOutput = cleanGoal.toLowerCase().includes("prd") ? prd : genericOutput;

  const result = {
    Orchestrator: {
      output: `The orchestrator interpreted the goal, selected ${mode} orchestration, and routed work across Planner, Research, Writer, and Reviewer.`,
      time: 220,
      tokens: "simulated",
      cost: "N/A",
      status: "completed",
    },
    Planner: {
      output: `1. Interpret the user goal
2. Break it into structured sections
3. Gather context and assumptions
4. Draft the main deliverable
5. Review completeness and clarity
6. Present final output`,
      time: 480,
      tokens: "simulated",
      cost: "N/A",
      status: "completed",
    },
    Research: {
      output: `Key assumptions:
- The user expects a structured output
- Context and risks improve quality
- Review improves alignment and readability

Potential risks:
- Over-scoping the output
- Missing practical details if the goal is vague`,
      time: 560,
      tokens: "simulated",
      cost: "N/A",
      status: "completed",
    },
    Writer: {
      output: finalOutput,
      time: 690,
      tokens: "simulated",
      cost: "N/A",
      status: "completed",
    },
    Reviewer: {
      output: `The output is structured and aligned to the user goal. Improvement note: add examples, user flows, or acceptance criteria in the next iteration if needed.`,
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
      reason: reason.includes("aborted")
        ? "OpenAI took longer than the allowed response time, so the app switched to the fallback engine to complete the workflow."
        : reason,
    },
    meta: {
      mode,
      instructionStyle,
      flowOrder,
      executionType: "multi_agent",
      eligible: true,
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
    goal_output: finalOutput,
    explanation: `This run used the template fallback. The orchestrator coordinated the workflow, the Planner structured the path, the Research agent gathered context, the Writer produced the deliverable, and the Reviewer validated quality.`,
    totals: {
      totalTokens: "simulated",
      estimatedCost: "N/A",
    },
  };
}

function buildFallbackSingleAgentWorkflow(goal, instructionStyle, reason = "Fallback mode was used.") {
  const cleanGoal = clean(goal);

  return {
    source: "Template Fallback",
    providerStatus: {
      openai: "not_used",
      reason: reason.includes("aborted")
        ? "OpenAI took longer than the allowed response time, so the app switched to the fallback engine to complete the workflow."
        : reason,
    },
    meta: {
      mode: "single-agent",
      instructionStyle,
      flowOrder: ["Single Agent", "Goal Output"],
      executionType: "single_agent",
      eligible: false,
    },
    result: {
      "Single Agent": {
        output: `Direct response for: ${cleanGoal}

This task is better suited to a single-agent flow because it does not require planning, research decomposition, multi-step synthesis, or review orchestration.`,
        time: 220,
        tokens: "simulated",
        cost: "N/A",
        status: "completed",
      },
    },
    shared_memory: {
      execution_context: `Goal: ${cleanGoal}`,
      task_graph: "Single Agent → Goal Output",
      planner_output: "Not used in single-agent mode.",
      research_output: "Not used in single-agent mode.",
      reviewer_notes: "Not used in single-agent mode.",
      final_synthesis: "Single-agent flow was selected because the task was simple enough to answer directly.",
    },
    goal_output: `Direct response for: ${cleanGoal}`,
    explanation: `This run used single-agent execution because the request did not strongly benefit from planning, research decomposition, or multi-stage orchestration.`,
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

async function buildSingleAgentOpenAIWorkflow(goal, apiKey, instructionStyle) {
  const prompt = buildSingleAgentPrompt(goal, instructionStyle);
  const payload = await callOpenAI(prompt, apiKey);
  const rawText = extractResponseText(payload);

  if (!rawText) throw new Error("OpenAI returned no text.");

  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error("OpenAI did not return valid JSON.");
  }

  const usage = estimateOpenAICost(payload?.usage || {});

  return {
    source: "OpenAI",
    providerStatus: {
      openai: "working",
      model: OPENAI_MODEL,
    },
    meta: {
      mode: "single-agent",
      instructionStyle,
      flowOrder: ["Single Agent", "Goal Output"],
      executionType: "single_agent",
      eligible: false,
    },
    result: {
      "Single Agent": {
        output: parsed.answer || "No answer returned.",
        time: 500,
        tokens: usage.totalTokens,
        cost: `$${usage.estimatedCost.toFixed(4)}`,
        status: "completed",
      },
    },
    shared_memory: {
      execution_context: `Goal: ${goal}`,
      task_graph: "Single Agent → Goal Output",
      planner_output: "Not used in single-agent mode.",
      research_output: "Not used in single-agent mode.",
      reviewer_notes: "Not used in single-agent mode.",
      final_synthesis: parsed.explanation || "Single-agent mode was sufficient for this request.",
    },
    goal_output: parsed.answer || "No answer returned.",
    explanation: parsed.explanation || "Single-agent mode was sufficient for this request.",
    totals: {
      totalTokens: usage.totalTokens,
      estimatedCost: `$${usage.estimatedCost.toFixed(4)}`,
    },
  };
}

async function buildMultiAgentOpenAIWorkflow(goal, apiKey, mode, instructionStyle) {
  const prompt = buildMultiAgentPrompt(goal, mode, instructionStyle);
  const payload = await callOpenAI(prompt, apiKey);
  const rawText = extractResponseText(payload);

  if (!rawText) throw new Error("OpenAI returned no text.");

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
      executionType: "multi_agent",
      eligible: true,
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
    goal_output: parsed.goal_output || parsed.writer || `Generated output for: ${goal}`,
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
    const eligibleForMultiAgent = isMultiAgentEligible(goal);

    if (!apiKeyToUse) {
      if (eligibleForMultiAgent) {
        return res.json(
          buildFallbackMultiAgentWorkflow(
            goal,
            mode,
            instructionStyle,
            "No OpenAI key was available, so template fallback was used."
          )
        );
      }

      return res.json(
        buildFallbackSingleAgentWorkflow(
          goal,
          instructionStyle,
          "No OpenAI key was available, so single-agent template fallback was used."
        )
      );
    }

    if (eligibleForMultiAgent) {
      const workflowPromise = buildMultiAgentOpenAIWorkflow(goal, apiKeyToUse, mode, instructionStyle);

      const timeoutFallbackPromise = new Promise((resolve) => {
        setTimeout(() => {
          resolve(
            buildFallbackMultiAgentWorkflow(
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
    }

    const workflowPromise = buildSingleAgentOpenAIWorkflow(goal, apiKeyToUse, instructionStyle);

    const timeoutFallbackPromise = new Promise((resolve) => {
      setTimeout(() => {
        resolve(
          buildFallbackSingleAgentWorkflow(
            goal,
            instructionStyle,
            `OpenAI workflow exceeded ${REQUEST_TIMEOUT_MS} ms, so single-agent template fallback was used.`
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
      buildFallbackSingleAgentWorkflow(
        "Workflow request",
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