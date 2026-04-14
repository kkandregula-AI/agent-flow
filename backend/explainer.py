def explain_workflow(goal):
    return f"""
Goal: {goal}

This workflow uses an orchestrator to coordinate multiple AI agents:

• Planner → Breaks the goal into steps  
• Research → Collects insights  
• Writer → Produces output  
• Reviewer → Validates quality  

The orchestrator ensures proper execution and flow.
"""