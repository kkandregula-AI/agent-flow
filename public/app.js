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

    const data = await res.json();
    console.log("API response:", data);

    const agents = data.result || {};
    const names = Object.keys(agents);

    flow.innerHTML = "";
    feed.innerHTML = "";

    if (names.length === 0) {
      flow.innerHTML = "<div class='node active'>No agent data returned</div>";
      feed.innerHTML = "<div class='feed-item'>The backend responded, but no agent outputs were returned.</div>";
      output.innerHTML = data.goal_output || "No goal output returned.";
      explainer.innerHTML = data.explanation || "No workflow explanation returned.";
      return;
    }

    for (const name of names) {
      const r = agents[name];

      const node = document.createElement("div");
      node.className = "node active";
      node.textContent = name;
      flow.appendChild(node);

      feed.innerHTML += `
        <div class="feed-item">
          <strong>${name}</strong><br>
          ${String(r.output || "No output").replace(/\n/g, "<br>")}<br><br>
          ⏱ ${r.time ?? "N/A"} ms<br>
          Tokens: ${r.tokens ?? "N/A"}<br>
          Cost: ${r.cost ?? "N/A"}
        </div>
      `;
    }

    output.innerHTML = `
      <strong>Goal Achieved Successfully</strong><br><br>
      ${String(data.goal_output || "No goal output returned.").replace(/\n/g, "<br>")}
    `;

    explainer.innerHTML = String(data.explanation || "No workflow explanation returned.").replace(/\n/g, "<br>");
  } catch (err) {
    console.error(err);
    flow.innerHTML = "<div class='node active'>Workflow failed</div>";
    feed.innerHTML = `<div class="feed-item">Error: ${err.message}</div>`;
    output.innerHTML = "The workflow did not complete successfully.";
    explainer.innerHTML = "Please check Railway logs.";
  }
}