async function run() {
  const goal = document.getElementById("goal").value;

  const res = await fetch("http://localhost:8000/api/run", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ goal })
  });

  const data = await res.json();

  const flow = document.getElementById("flow");
  const feed = document.getElementById("feed");

  flow.innerHTML = "";
  feed.innerHTML = "";

  for (let agent in data.result) {

    const node = document.createElement("div");
    node.className = "node";
    node.innerText = agent;

    flow.appendChild(node);

    // 🔥 Animation
    await new Promise(r => setTimeout(r, 500));
    node.classList.add("active");

    const r = data.result[agent];

    feed.innerHTML += `
      <div class="feed-item">
        <strong>${agent}</strong><br>
        ${r.output}<br>
        ⏱ ${r.time}ms
      </div>
    `;
  }

  document.getElementById("output").innerText = "Goal Achieved Successfully";
  document.getElementById("explainer").innerText = data.explanation;
}