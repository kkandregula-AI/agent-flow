async function run() {
  const goal = document.getElementById("goal").value.trim();
  const mode = document.getElementById("mode").value;
  const instructionStyle = document.getElementById("instructionStyle").value;
  const userApiKey = document.getElementById("apikey").value.trim();

  const sourceBadge = document.getElementById("sourceBadge");
  const providerNote = document.getElementById("providerNote");
  const feed = document.getElementById("feed");
  const output = document.getElementById("output");
  const explainer = document.getElementById("explainer");

  sourceBadge.textContent = "Running...";
  providerNote.textContent = "Calling backend...";
  feed.innerHTML = "<div class='feed-item'>Starting request...</div>";
  output.innerHTML = "";
  explainer.innerHTML = "";

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch("/api/run", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        goal,
        mode,
        instructionStyle,
        userApiKey: userApiKey || null
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const text = await res.text();

    sourceBadge.textContent = "DONE ✅";
    providerNote.textContent = `Backend responded with HTTP ${res.status}.`;

    feed.innerHTML = `
      <div class="feed-item">
        <strong>Raw Response</strong>
        <pre style="white-space:pre-wrap;word-break:break-word;">${escapeHtml(text)}</pre>
      </div>
    `;

    try {
      const data = JSON.parse(text);
      output.innerHTML = `
        <div class="goal-result">
          <div class="goal-title">Goal Output</div>
          <div class="goal-body">${escapeHtml(data.goal_output || "No goal_output returned.")}</div>
        </div>
      `;
      explainer.innerHTML = `
        <div class="explain-box">${escapeHtml(data.explanation || "No explanation returned.")}</div>
      `;
    } catch {
      output.innerHTML = "Response was not valid JSON.";
      explainer.innerHTML = "See raw response above.";
    }
  } catch (error) {
    clearTimeout(timeoutId);

    sourceBadge.textContent = "ERROR ❌";

    if (error.name === "AbortError") {
      providerNote.textContent = "Browser request timed out after 12 seconds.";
      feed.innerHTML = `
        <div class="feed-item">
          The browser fetch to <code>/api/run</code> timed out after 12 seconds.
          This usually means the page is using stale frontend code or a service worker is interfering.
        </div>
      `;
    } else {
      providerNote.textContent = error.message;
      feed.innerHTML = `<div class="feed-item">Fetch failed: ${escapeHtml(error.message)}</div>`;
    }

    output.innerHTML = "";
    explainer.innerHTML = "";
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

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}