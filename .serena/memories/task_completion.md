# Task completion checklist for cc-roundtable
- Re-read AGENTS.md and docs/service-overview.md if the change touches runtime lifecycle, hooks, or architecture-sensitive behavior.
- If you changed daemon/client payloads, verify packages/shared-contracts and all callers stay aligned.
- If you changed draw.io diagrams, regenerate SVGs using the official @hhhtj/draw.io export path rather than unofficial converters.
- If you changed docs/rearchitecture proposals, keep .drawio source files in source/ and rendered md/svg at the proposal root.
- Before reporting implementation complete, run `npm --prefix electron run verify:final`.
- verify:final covers typecheck, build, and the required Electron GUI E2E flow including recovery.
- If verify:final cannot be run, do not present the task as fully complete; explicitly call out the blocker.
- Avoid reverting unrelated user changes in the dirty worktree.