# /handoff — Post Structured Chunk Handoff

Generate and post a structured handoff entry after completing a chunk. Posts to the Notion Handoff Page if MCP is available, otherwise writes to `tasks/doc-updates.md`.

**Usage:** `/handoff`

---

## Procedure

### Step 1: Gather chunk context

Collect the following information. Auto-populate what you can, ask for what you can't:

1. **Chunk number and title:** From the chunk spec you were given
2. **Thing designation:** Read from CLAUDE.md header (e.g., "Thing 1")
3. **Date and time:** Current timestamp
3. **Task:** What was asked (from the chunk spec)
4. **Completed:** What was actually built (your summary)
5. **Sub-agents used:** Count and brief description of any `/delegate` tasks. "None" if no sub-agents were used.
6. **Files modified:** Run `git diff --name-only HEAD~1` if already committed, or `git diff --name-only` + `git diff --name-only --cached` if not yet committed. Include files modified by sub-agents.
7. **Tests:** Count new tests, modified tests, and total passing. Run the project's test command to get current count.
8. **Deviations:** Anything that differed from the chunk spec. "None" if spec was followed exactly.
9. **Doc flags:** Any behavior, threshold, or logic that may need documentation updates. "None" if nothing needs flagging.
10. **Git commit:** Run `git log -1 --oneline` for the commit hash and message. If not yet committed, note "pending commit."
11. **Suggested next:** Brief description of what should come next, or "ask orchestrator."

### Step 2: Format the handoff

```
## Chunk [N] — [Title] (Thing [N]) — [date] [time]
**Task:** [what was asked]
**Completed:** [what was actually built]
**Sub-agents used:** [N] ([brief description of each delegation, or "none"])
**Files modified:** [list of files touched, including by sub-agents]
**Tests:** [N new, N modified, N total passing]
**Deviations:** [anything that differed from the plan, or "none"]
**Doc flags:** [any behavior, threshold, or logic that may need doc updates, or "none"]
**Git commit:** [commit hash and message]
**Suggested next:** [brief description, or "ask orchestrator"]
```

### Step 3: Post the handoff

**If Notion MCP is available:**
1. Read the Handoff Page URL from CLAUDE.md (under "After completing a chunk")
2. Append the formatted handoff to the page using the Notion MCP
3. Confirm the post was successful

**If Notion MCP is unavailable:**
1. Write the formatted handoff to `tasks/doc-updates.md`
2. Add a note: "Posted to doc-updates.md — Notion MCP was unavailable"

### Step 4: Update tracking files

1. Update `tasks/todo.md` — mark the chunk as completed
2. Update `tasks/active-chunks.md` — move the chunk from Active to Completed, clear any sub-agent lines
3. If any lessons were learned during this chunk, write them to `tasks/lessons.md`

### Step 5: Confirm

Print a summary:
```
✓ Handoff posted for Chunk [N] — [Title]
  Destination: [Notion / doc-updates.md]
  Files modified: [count]
  Tests: [total passing]
  Sub-agents: [count]
```
