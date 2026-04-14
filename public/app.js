async function run() {
  const goal = document.getElementById("goal").value.trim();
  const apiKey = document.getElementById("apikey").value.trim();

  const flow = document.getElementById("flow");
  const feed = document.getElementById("feed");
  const output = document.getElementById("output");
  const explainer = document.getElementById("explainer");

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

      await new Promise((resolve) => setTimeout(resolve, 250));
      node.classList.add("active");

      feed.innerHTML += `
        <div class="feed-item">
          <strong>${escapeHtml(agentName)}</strong><br>
          ${formatMultiline(agent.output || "No output")}<br><br>
          ⏱ ${escapeHtml(String(agent.time ?? "N/A"))} ms<br>
          Tokens: ${escapeHtml(String(agent.tokens ?? "N/A"))}<br>
          Cost: ${escapeHtml(String(agent.cost ?? "N/A"))}
        </div>
      `;
    }

    output.innerHTML = `
      <strong>Goal Achieved Successfully</strong><br><br>
      ${formatMultiline(data.goal_output || "No goal output returned.")}
    `;

    explainer.innerHTML = formatMultiline(
      data.explanation || "No workflow explanation returned."
    );
  } catch (error) {
    console.error("Frontend workflow error:", error);
    flow.innerHTML = "<div class='node active'>Workflow failed</div>";
    feed.innerHTML = `<div class="feed-item">Error: ${escapeHtml(error.message)}</div>`;
    output.innerHTML = "The workflow did not complete successfully.";
    explainer.innerHTML = "Please check the backend and browser console.";
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