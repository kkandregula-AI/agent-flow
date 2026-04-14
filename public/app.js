async function run() {
  const goal = document.getElementById("goal").value.trim();
  const apiKey = document.getElementById("apikey").value.trim();

  const sourceBadge = document.getElementById("sourceBadge");
  const providerNote = document.getElementById("providerNote");
  const totalsBox = document.getElementById("totalsBox");
  const flow = document.getElementById("flow");
  const feed = document.getElementById("feed");
  const output = document.getElementById("output");
  const explainer = document.getElementById("explainer");

  sourceBadge.textContent = "Running...";
  providerNote.textContent = "Checking provider and executing workflow.";
  totalsBox.innerHTML = "";
  flow.innerHTML = "<div class='node active'>Starting workflow...</div>";
  feed.innerHTML = "<div class='feed-item'>Running agents...</div>";
  output.innerHTML = "";
  explainer.innerHTML = "";

  try {
    const res = await fetch("/api/run", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        goal,
        userApiKey: apiKey || null,
      }),
    });

    const data = await res.json();
    console.log("API FULL RESPONSE:", data);

    const agents = data.result || {};
    const agentNames = Object.keys(agents);

    sourceBadge.textContent = data.source || "Unknown Source";

    if (data.providerStatus?.openai === "working") {
      providerNote.textContent = `OpenAI is working${data.providerStatus.model ? ` using ${data.providerStatus.model}` : ""}.`;
    } else if (String(data.providerStatus?.openai || "").startsWith("failed")) {
      providerNote.textContent = "OpenAI request failed. Fallback mode was used.";
    } else {
      providerNote.textContent = data.providerStatus?.reason || "Fallback mode was used.";
    }

    totalsBox.innerHTML = `
      <div class="metric">
        <span class="metric-label">Total Tokens</span>
        <span class="metric-value">${escapeHtml(String(data.totals?.totalTokens ?? "N/A"))}</span>
      </div>
      <div class="metric">
        <span class="metric-label">Estimated Cost</span>
        <span class="metric-value">${escapeHtml(String(data.totals?.estimatedCost ?? "N/A"))}</span>
      </div>
    `;

    flow.innerHTML = "";
    feed.innerHTML = "";

    if (agentNames.length === 0) {
      flow.innerHTML = "<div class='node active'>No agent data returned</div>";
      feed.innerHTML = `<div class="feed-item"><pre>${escapeHtml(JSON.stringify(data, null, 2))}</pre></div>`;
      output.innerHTML = data.goal_output || "No goal output returned.";
      explainer.innerHTML = data.explanation || "No workflow explanation returned.";
      return;
    }

    for (const agentName of agentNames) {
      const agent = agents[agentName];

      const node = document.createElement("div");
      node.className = "node";
      node.textContent = agentName;
      flow.appendChild(node);

      await new Promise((resolve) => setTimeout(resolve, 180));
      node.classList.add("active");

      feed.innerHTML += `
        <div class="feed-item">
          <div class="feed-head">
            <strong>${escapeHtml(agentName)}</strong>
            <span class="status-chip">${escapeHtml(String(agent.status ?? "completed"))}</span>
          </div>
          <div class="feed-body">
            ${formatMultiline(agent.output || "No output")}
          </div>
          <div class="feed-metrics">
            <span>⏱ ${escapeHtml(String(agent.time ?? "N/A"))} ms</span>
            <span>Tokens: ${escapeHtml(String(agent.tokens ?? "N/A"))}</span>
            <span>Cost: ${escapeHtml(String(agent.cost ?? "N/A"))}</span>
          </div>
        </div>
      `;
    }

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
    flow.innerHTML = "<div class='node active'>Workflow failed</div>";
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

  keyStatus.textContent = "Validating key...";
  keyStatus.className = "key-status neutral";

  try {
    const res = await fetch("/api/validate-key", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userApiKey: apiKey }),
    });

    const data = await res.json();

    if (data.ok) {
      keyStatus.textContent = "Key is valid and working.";
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

function formatMultiline(text) {
  return escapeHtml(String(text)).replace(/\n/g, "<br>");
}

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}