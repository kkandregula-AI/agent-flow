async function run() {
  const goal = document.getElementById("goal").value.trim();
  const apiKey = document.getElementById("apikey").value.trim();
  const mode = document.getElementById("mode").value;
  const instructionStyle = document.getElementById("instructionStyle").value;

  const sourceBadge = document.getElementById("sourceBadge");
  const providerNote = document.getElementById("providerNote");
  const totalsBox = document.getElementById("totalsBox");
  const flow = document.getElementById("flow");
  const feed = document.getElementById("feed");
  const output = document.getElementById("output");
  const explainer = document.getElementById("explainer");

  const memoryExecution = document.getElementById("memoryExecution");
  const memoryTaskGraph = document.getElementById("memoryTaskGraph");
  const memoryPlanner = document.getElementById("memoryPlanner");
  const memoryResearch = document.getElementById("memoryResearch");
  const memoryReviewer = document.getElementById("memoryReviewer");
  const memorySynthesis = document.getElementById("memorySynthesis");

  const visualMode = document.getElementById("visualMode");
  const visualStyle = document.getElementById("visualStyle");
  const visualOrder = document.getElementById("visualOrder");
  const visualizer = document.getElementById("visualizer");
  const executionMap = document.getElementById("executionMap");

  sourceBadge.textContent = "Running...";
  providerNote.textContent = "Calling backend...";
  totalsBox.innerHTML = "";
  flow.innerHTML = "<div class='flow-step active'>Loading...</div>";
  feed.innerHTML = "<div class='feed-item'>Waiting for API response...</div>";
  output.innerHTML = "";
  explainer.innerHTML = "";

  try {
    const res = await fetch("/api/run", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        goal,
        userApiKey: apiKey || null,
        mode,
        instructionStyle
      })
    });

    const data = await res.json();
    console.log("API FULL RESPONSE:", data);

    const agents = normalizeAgents(data.result || {});
    const flowOrder = data.meta?.flowOrder || [
      "Orchestrator",
      "Planner",
      "Research",
      "Writer",
      "Reviewer",
      "Goal Output"
    ];

    sourceBadge.textContent = "Done ✅";

    if (data.providerStatus?.openai === "working") {
      providerNote.textContent = `OpenAI is working${data.providerStatus.model ? ` using ${data.providerStatus.model}` : ""}.`;
    } else {
      providerNote.textContent = data.providerStatus?.reason || "Template fallback was used.";
    }

    totalsBox.innerHTML = `
      <div class="metric-row">
        <div class="metric-card">
          <div class="metric-label">Mode Used</div>
          <div class="metric-value">${escapeHtml(String(mode))}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Instruction Style</div>
          <div class="metric-value">${escapeHtml(String(instructionStyle))}</div>
        </div>
      </div>
      <div class="metric-row">
        <div class="metric-card">
          <div class="metric-label">Total Tokens</div>
          <div class="metric-value">${escapeHtml(String(data.totals?.totalTokens ?? "N/A"))}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Estimated Cost</div>
          <div class="metric-value">${escapeHtml(String(data.totals?.estimatedCost ?? "N/A"))}</div>
        </div>
      </div>
    `;

    memoryExecution.textContent = data.shared_memory?.execution_context || `Goal: ${goal}`;
    memoryTaskGraph.textContent = data.shared_memory?.task_graph || flowOrder.join(" → ");
    memoryPlanner.innerHTML = formatMultiline(normalizeMemoryValue(data.shared_memory?.planner_output, agents.Planner?.output, "No planner output."));
    memoryResearch.innerHTML = formatMultiline(normalizeMemoryValue(data.shared_memory?.research_output, agents.Research?.output, "No research output."));
    memoryReviewer.innerHTML = formatMultiline(normalizeMemoryValue(data.shared_memory?.reviewer_notes, agents.Reviewer?.output, "No reviewer notes."));
    memorySynthesis.innerHTML = formatMultiline(normalizeMemoryValue(data.shared_memory?.final_synthesis, agents.Orchestrator?.output, "No final synthesis."));

    visualMode.textContent = mode;
    visualStyle.textContent = instructionStyle;
    visualOrder.textContent = flowOrder.join(" → ");

    if (executionMap) {
      executionMap.innerHTML = flowOrder.map(step => `
        <div class="map-card active">
          <div class="map-card-title">${escapeHtml(step)}</div>
          <div class="map-card-sub">Completed</div>
        </div>
      `).join("");
    }

    if (visualizer) {
      visualizer.innerHTML = flowOrder.map(step => `
        <div class="visual-node active">
          <div class="visual-kicker">${escapeHtml(step === "Goal Output" ? "Delivered Result" : "Agent Step")}</div>
          <div class="visual-title">${escapeHtml(step)}</div>
        </div>
      `).join("");
    }

    flow.innerHTML = flowOrder.map(step => {
      if (step === "Goal Output") {
        return `
          <div class="flow-step active">
            <div class="flow-step-title">Goal Output</div>
            <div class="flow-step-sub">Completed</div>
          </div>
        `;
      }

      const agent = agents[step];
      if (!agent) return "";

      return `
        <div class="flow-step active">
          <div class="flow-step-title">${escapeHtml(step)}</div>
          <div class="flow-step-sub">${escapeHtml(String(agent.status || "completed"))}</div>
        </div>
      `;
    }).join("");

    const feedHtml = [];
    for (const step of flowOrder) {
      if (step === "Goal Output") continue;
      const agent = agents[step];
      if (!agent) continue;

      feedHtml.push(`
        <div class="feed-item">
          <div class="feed-head">
            <strong>${escapeHtml(step)}</strong>
            <span class="status-chip">${escapeHtml(String(agent.status || "completed"))}</span>
          </div>
          <div class="feed-body">${formatMultiline(agent.output || "No output returned from backend.")}</div>
          <div class="feed-metrics">
            <span>⏱ ${escapeHtml(String(agent.time ?? "—"))} ms</span>
            <span>Tokens: ${escapeHtml(String(agent.tokens ?? "—"))}</span>
            <span>Cost: ${escapeHtml(String(agent.cost ?? "—"))}</span>
          </div>
        </div>
      `);
    }
    feed.innerHTML = feedHtml.join("") || "<div class='feed-item'>No agent feed returned.</div>";

    output.innerHTML = `
      <div class="goal-result">
        <div class="goal-title">Goal Achieved Output</div>
        <div class="goal-body">${formatMultiline(data.goal_output || agents.Writer?.output || "No goal output returned.")}</div>
      </div>
    `;

    explainer.innerHTML = `
      <div class="explain-box">
        ${formatMultiline(data.explanation || agents.Orchestrator?.output || "No workflow explanation returned.")}
      </div>
    `;
  } catch (error) {
    console.error("Frontend workflow error:", error);
    sourceBadge.textContent = "Error";
    providerNote.textContent = error.message;
    flow.innerHTML = "<div class='flow-step active'>Workflow failed</div>";
    feed.innerHTML = `<div class="feed-item">Error: ${escapeHtml(error.message)}</div>`;
    output.innerHTML = "The workflow did not complete successfully.";
    explainer.innerHTML = "Please check the backend and browser console.";
  }
}

async function validateKey() {
  const apiKey = document.getElementById("apikey").value.trim();
  const keyStatus = document.getElementById("keyStatus");

  if (!apiKey) {
    keyStatus.textContent = "Enter a key first.";
    keyStatus.className = "key-status neutral";
    return;
  }

  keyStatus.textContent = "Validating OpenAI key...";
  keyStatus.className = "key-status neutral";

  try {
    const res = await fetch("/api/validate-key", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ userApiKey: apiKey })
    });

    const data = await res.json();

    if (data.ok) {
      keyStatus.textContent = "OpenAI key is valid and working.";
      keyStatus.className = "key-status ok";
    } else {
      keyStatus.textContent = data.message || "Key validation failed.";
      keyStatus.className = "key-status bad";
    }
  } catch (error) {
    keyStatus.textContent = `Validation error: ${error.message}`;
    keyStatus.className = "key-status bad";
  }
}

function normalizeAgents(rawAgents) {
  const normalized = {};

  for (const [name, raw] of Object.entries(rawAgents)) {
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      normalized[name] = {
        output: toText(raw.output),
        time: raw.time ?? "—",
        tokens: raw.tokens ?? "—",
        cost: raw.cost ?? "—",
        status: raw.status ?? "completed"
      };
    } else {
      normalized[name] = {
        output: toText(raw) || "No output returned from backend.",
        time: "—",
        tokens: "—",
        cost: "—",
        status: "completed"
      };
    }
  }

  return normalized;
}

function normalizeMemoryValue(value, fallback, emptyText) {
  const text = toText(value);
  if (text) return text;
  if (fallback) return fallback;
  return emptyText;
}

function toText(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(item => toText(item)).filter(Boolean).join("\n");
  if (typeof value === "object") {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function formatMultiline(text) {
  return escapeHtml(toText(text)).replace(/\n/g, "<br>");
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}