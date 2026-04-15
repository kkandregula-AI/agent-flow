async function run() {
  const goal = document.getElementById("goal").value.trim();

  const sourceBadge = document.getElementById("sourceBadge");
  const feed = document.getElementById("feed");
  const output = document.getElementById("output");

  sourceBadge.textContent = "Running...";
  feed.innerHTML = "Calling backend...";
  output.innerHTML = "";

  try {
    const res = await fetch("/api/run", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        goal,
        mode: "planner-first",
        instructionStyle: "balanced"
      })
    });

    const data = await res.json();

    // 🔥 FORCE UI UPDATE (no fancy logic)
    sourceBadge.textContent = "DONE ✅";

    feed.innerHTML = `
      <pre style="white-space:pre-wrap;">
${JSON.stringify(data, null, 2)}
      </pre>
    `;

    output.innerHTML = `
      <div style="padding:20px;">
        <h3>Goal Output</h3>
        <div>${data.goal_output}</div>
      </div>
    `;

  } catch (err) {
    sourceBadge.textContent = "ERROR ❌";
    feed.innerHTML = err.message;
  }
}