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

  sourceBadge.textContent = "Running...";
  providerNote.textContent = "Calling backend and executing workflow.";
  totalsBox.innerHTML = "";
  flow.innerHTML = "<div class='flow-step active'>Starting workflow...</div>";
  feed.innerHTML = "<div class='feed-item'>Running agents...</div>";
  output.innerHTML = "";
  explainer.innerHTML = "";

  memoryExecution.textContent = "Running...";
  memoryTaskGraph.textContent = "Running...";
  memoryPlanner.textContent = "Waiting for planner output...";
  memoryResearch.textContent = "Waiting for research output...";
  memoryReviewer.textContent = "Waiting for reviewer notes...";
  memorySynthesis.textContent = "Waiting for final synthesis...";

  visualMode.textContent = mode;
  visualStyle.textContent = instructionStyle;
  visualOrder.textContent = "Building flow...";
  visualizer.innerHTML = "";

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

    const agents = data.result || {};
    const flowOrder = data.meta?.flowOrder || [
      "Orchestrator",
      "Planner",
      "Research",
      "Writer",
      "Reviewer",
      "Goal Output"
    ];

    sourceBadge.textContent = data.source || "Unknown Source";

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

    memoryPlanner.innerHTML = formatMultiline(
      Array.isArray(data.shared_memory?.planner_output)
        ? data.shared_memory.planner_output.join("\n")
        : data.shared_memory?.planner_output || "No planner output."
    );

    memoryResearch.innerHTML = formatMultiline(
      Array.isArray(data.shared_memory?.research_output)
        ? data.shared_memory.research_output.join("\n")
        : data.shared_memory?.research_output || "No research output."
    );

    memoryReviewer.innerHTML = formatMultiline(
      Array.isArray(data.shared_memory?.reviewer_notes)
        ? data.shared_memory.reviewer_notes.join("\n")
        : data.shared_memory?.reviewer_notes || "No reviewer notes."
    );

    memorySynthesis.innerHTML = formatMultiline(
      Array.isArray(data.shared_memory?.final_synthesis)
        ? data.shared_memory.final_synthesis.join("\n")
        : data.shared_memory?.final_synthesis || "No final synthesis."
    );

    visualMode.textContent = mode;
    visualStyle.textContent = instructionStyle;
    visualOrder.textContent = flowOrder.join(" → ");

    renderVisualizer(flowOrder);
    renderExecutionMap(flowOrder);

    flow.innerHTML = "";
    feed.innerHTML = "";

    const agentNames = Object.keys(agents);

    if (agentNames.length === 0) {
      flow.innerHTML = "<div class='flow-step active'>No agent data returned</div>";
      feed.innerHTML = `<div class="feed-item"><pre>${escapeHtml(JSON.stringify(data, null, 2))}</pre></div>`;
      output.innerHTML = data.goal_output || "No goal output returned.";
      explainer.innerHTML = data.explanation || "No workflow explanation returned.";
      return;
    }

    for (const agentName of flowOrder) {
      if (agentName === "Goal Output") {
        await pulseVisualizer(agentName);
        continue;
      }

      const raw = agents[agentName];

      const agent = typeof raw === "string"
        ? {
            output: raw,
            time: "—",
            tokens: "—",
            cost: "—",
            status: "completed"
          }
        : raw;

      if (!agent) continue;

      flow.innerHTML += `
        <div class="flow-step active">
          <div class="flow-step-title">${escapeHtml(agentName)}</div>
          <div class="flow-step-sub">${escapeHtml(String(agent.status || "completed"))}</div>
        </div>
      `;

      await pulseVisualizer(agentName);

      feed.innerHTML += `
        <div class="feed-item">
          <div class="feed-head">
            <strong>${escapeHtml(agentName)}</strong>
            <span class="status-chip">${escapeHtml(String(agent.status || "completed"))}</span>
          </div>
          <div class="feed-body">
            ${formatMultiline(agent.output || "No output")}
          </div>
          <div class="feed-metrics">
            <span>⏱ ${escapeHtml(String(agent.time ?? "—"))} ms</span>
            <span>Tokens: ${escapeHtml(String(agent.tokens ?? "—"))}</span>
            <span>Cost: ${escapeHtml(String(agent.cost ?? "—"))}</span>
          </div>
        </div>
      `;
    }

    await pulseVisualizer("Goal Output");

    output.innerHTML = `
      <div class="goal-result">
        <div class="goal-title">Goal Achieved Output</div>
        <div class="goal-body">${formatMultiline(data.goal_output || "No goal output returned.")}</div>
      </div>
    `;

    explainer.innerHTML = `
      <div class="explain-box">
        ${formatMultiline(data.explanation || "No workflow explanation returned.")}
      </div>
    `;
  } catch (error) {
    console.error("Frontend workflow error:", error);
    sourceBadge.textContent = "Error";
    providerNote.textContent = "The request failed before the workflow could complete.";
    totalsBox.innerHTML = "";
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

function renderExecutionMap(flowOrder) {
  const map = document.getElementById("executionMap");
  map.innerHTML = "";

  for (const step of flowOrder) {
    map.innerHTML += `
      <div class="map-card" id="map-${slug(step)}">
        <div class="map-card-title">${escapeHtml(step)}</div>
        <div class="map-card-sub">Waiting</div>
      </div>
    `;
  }
}

function renderVisualizer(flowOrder) {
  const visualizer = document.getElementById("visualizer");
  visualizer.innerHTML = "";

  for (const step of flowOrder) {
    visualizer.innerHTML += `
      <div class="visual-node" id="visual-${slug(step)}">
        <div class="visual-kicker">${escapeHtml(step === "Goal Output" ? "Delivered Result" : "Agent Step")}</div>
        <div class="visual-title">${escapeHtml(step)}</div>
      </div>
    `;
  }
}

async function pulseVisualizer(stepName) {
  const visualNode = document.getElementById(`visual-${slug(stepName)}`);
  const mapNode = document.getElementById(`map-${slug(stepName)}`);

  if (visualNode) {
    visualNode.classList.add("active");
  }

  if (mapNode) {
    mapNode.classList.add("active");
    const sub = mapNode.querySelector(".map-card-sub");
    if (sub) sub.textContent = "Completed";
  }

  await new Promise((resolve) => setTimeout(resolve, 180));
}

function slug(text) {
  return String(text).toLowerCase().replaceAll(" ", "-");
}

function formatMultiline(text) {
  return escapeHtml(String(text)).replace(/\n/g, "<br>");
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}