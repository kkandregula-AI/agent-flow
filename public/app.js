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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        goal,
        api_key: apiKey || null,
        mode: "planner-first"
      })
    });

    if (!res.ok) {
      throw new Error(`Request failed: ${res.status}`);
    }

    const data = await res.json();

    flow.innerHTML = "";
    feed.innerHTML = "";

    for (const agent in data.result) {
      const r = data.result[agent];

      const node = document.createElement("div");
      node.className = "node active";
      node.textContent = agent;
      flow.appendChild(node);

      feed.innerHTML += `
        <div class="feed-item">
          <strong>${agent}</strong><br>
          ${r.output}<br>
          ⏱ ${r.time} ms<br>
          Tokens: ${r.tokens}<br>
          Cost: ${r.cost}
        </div>
      `;
    }

    output.innerHTML = "<strong>Goal Achieved Successfully</strong>";
    explainer.textContent = data.explanation || "Workflow explanation generated.";
  } catch (err) {
    console.error(err);
    flow.innerHTML = "";
    feed.innerHTML = `<div class="feed-item">Error: ${err.message}</div>`;
    output.innerHTML = "Workflow failed.";
  }
}