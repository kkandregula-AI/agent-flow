import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";
import { buildPrompts } from "./prompts.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const PORT = process.env.PORT || 3000;

app.post("/api/run", async (req, res) => {
  const { goal, mode, instructionStyle, userApiKey } = req.body;

  let apiKey = userApiKey?.trim() || process.env.OPENAI_API_KEY;

  // 🔥 FALLBACK MODE
  if (!apiKey) {
    return res.json(runFallback(goal, mode));
  }

  try {
    const client = new OpenAI({ apiKey });

    const prompts = buildPrompts(goal);

    const agents = ["planner", "research", "writer", "review"];

    const results = {};
    let totalTokens = 0;

    for (let agent of agents) {
      const start = Date.now();

      const response = await client.responses.create({
        model: "gpt-4o-mini",
        input: prompts[agent],
      });

      const text = response.output_text;
      const tokens = response.usage.total_tokens;

      results[agent] = {
        output: text,
        time: Date.now() - start,
        tokens,
        cost: (tokens * 0.00001).toFixed(4),
      };

      totalTokens += tokens;
    }

    res.json({
      source: userApiKey ? "User Key" : "Server Key",
      results,
      totalTokens,
    });

  } catch (err) {
    console.error(err);
    res.json(runFallback(goal, mode));
  }
});

app.listen(PORT, () => console.log(`Server running on ${PORT}`));

// 🔥 FALLBACK ENGINE
function runFallback(goal) {
  return {
    source: "Fallback Engine",
    results: {
      planner: { output: "Task breakdown created", time: 500, tokens: "simulated", cost: "N/A" },
      research: { output: "Insights gathered", time: 600, tokens: "simulated", cost: "N/A" },
      writer: { output: "Draft created", time: 700, tokens: "simulated", cost: "N/A" },
      review: { output: "Final validated", time: 400, tokens: "simulated", cost: "N/A" },
    },
    totalTokens: "simulated",
    goalOutput: `Goal Achieved: ${goal}`
  };
}