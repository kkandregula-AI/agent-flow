async function run() {
  const goal = document.getElementById("goal").value.trim();
  const apiKey = document.getElementById("apikey").value.trim();

  const flow = document.getElementById("flow");
  const feed = document.getElementById("feed");
  const output = document.getElementById("output");
  const explainer = document.getElementById("explainer");

  flow.innerHTML = "<div class='node'>Starting workflow...</div>";
  feed.innerHTML = "<div class='feed-item'>Running agents...</div>";
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
        api_key: apiKey || null,
        mode: "planner-first"
      })
    });

    if (!res.ok) {
      throw new Error(`Request failed with status ${res.status}`);
    }

    const data = await res.json();
    const agents = data.result || {};

    flow.innerHTML = "";
    feed.innerHTML = "";

    const agentNames = Object.keys(agents);

    if (agentNames.length === 0) {
      flow.innerHTML = "<div class='node active'>No agent data returned</div>";
      feed.innerHTML = "<div class='feed-item'>The backend responded, but no agent outputs were returned.</div>";
      output.innerHTML = data.goal_output || "No goal output returned.";
      explainer.innerHTML = data.explanation || "No workflow explanation returned.";
      return;
    }

    for (const agent of agentNames) {
      const r = agents[agent];

      const node = document.createElement("div");
      node.className = "node";
      node.textContent = agent;
      flow.appendChild(node);

      await new Promise(resolve => setTimeout(resolve, 250));
      node.classList.add("active");

      feed.innerHTML += `
        <div class="feed-item">
          <strong>${agent}</strong><br>
          ${escapeHtml(String(r.output || "No output"))}<br><br>
          ⏱ ${r.time ?? "N/A"} ms<br>
          Tokens: ${r.tokens ?? "N/A"}<br>
          Cost: ${r.cost ?? "N/A"}
        </div>
      `;
    }

    output.innerHTML = `
      <strong>Goal Achieved Successfully</strong><br><br>
      ${escapeHtml(data.goal_output || "No goal output returned.")}
    `;

    explainer.innerHTML = escapeHtml(
      data.explanation || "Workflow explanation generated."
    );
  } catch (err) {
    console.error(err);
    flow.innerHTML = "<div class='node active'>Workflow failed</div>";
    feed.innerHTML = `<div class="feed-item">Error: ${escapeHtml(err.message)}</div>`;
    output.innerHTML = "The workflow did not complete successfully.";
    explainer.innerHTML = "Please check the backend response or deployment logs.";
  }
}

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}