export function buildPrompts(goal) {
  return {
    planner: `
You are a Planner Agent.
Break the goal into clear steps.

Goal:
${goal}
`,

    research: `
You are a Research Agent.
Provide insights and context.

Goal:
${goal}
`,

    writer: `
You are a Writer Agent.
Create the final output.

Goal:
${goal}
`,

    review: `
You are a Reviewer Agent.
Validate quality and completeness.

Goal:
${goal}
`
  };
}