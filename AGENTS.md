# AGENTS.md

This repository is a 0→1 AI generation product. Read MEMORY.md before changing code.

Goals:
- ship fast
- keep MVP scope tight
- support paid acquisition validation
- avoid unnecessary complexity

Working rules:
- Treat MEMORY.md as the current source of truth for product scope, tracking, and acceptance.
- Do not redefine requirements on your own.
- Prefer the smallest implementation that satisfies the approved scope.
- Keep image generation flow stable before expanding video/music scope.
- Include required GA4 tracking from MEMORY.md when touching landing, auth, pricing, checkout, generation, or result flows.
- If product logic, funnel logic, or tracking changes, update MEMORY.md before finishing.
- Do not claim tests passed unless they were actually run.
- Do not deploy production without explicit approval.

Before finishing any task:
1. summarize what changed
2. summarize what to test manually
3. summarize remaining risks
4. update MEMORY.md if key product/flow/tracking decisions changed