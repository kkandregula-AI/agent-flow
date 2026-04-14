def explain_workflow(goal: str, mode: str, source: str):
    return (
        f'For the goal "{goal}", the system used {mode} orchestration. '
        f'The Planner structured the task, the Research agent gathered context, '
        f'the Writer created the user-facing result, and the Reviewer validated quality. '
        f'The current AI source was: {source}.'
    )
"""