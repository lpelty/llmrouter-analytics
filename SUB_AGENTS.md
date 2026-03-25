# Sub-Agent Delegation Protocol

This document governs how the Thing (Claude Code terminal instance) delegates work to sub-agents via the Task tool.

---

## When to delegate

Delegate to a sub-agent when:

- **The task is self-contained.** It has clear file boundaries, a defined outcome, and doesn't require ongoing orchestration decisions.
- **Context pressure is building.** The Thing's context window is filling up. Delegating implementation work keeps the Thing lean for chunk-level coordination.
- **Parallel execution would help.** Two independent sub-tasks (e.g., implementing a client and writing its tests) can be delegated simultaneously.
- **The task is mechanically heavy.** Large file modifications, repetitive refactors, or test writing that would consume significant context without requiring strategic judgment.

Do NOT delegate when:

- **The task requires cross-file coordination** that depends on the results of another in-progress sub-task. Sequence these instead.
- **The task involves architectural decisions.** Those belong at the Thing or orchestrator level.
- **The task is trivial.** Spawning a sub-agent has overhead. If you can do it in 10 lines, just do it.
- **You'd need to pass most of your context.** If the sub-agent needs to understand the full chunk history to do the work, it's not a good delegation candidate.

---

## Delegation rules

### 1. Explicit scope boundaries

Every Task delegation must include:
- **Which files to read** (for context)
- **Which files to modify** (and ONLY those files)
- **Which files NOT to touch** (explicit exclusions for adjacent files)
- **A Do NOT list** specific to this sub-task

### 2. Recon before modify

Include in every delegation: "Run `/recon <target>` on any file before modifying it if it has dependents, failure history, or you're changing its exported interface."

### 3. Structured return format

Instruct every sub-agent to return results in this format:

```
## Sub-agent result

**Task:** [what was asked]
**Completed:** [what was actually done]
**Files modified:** [list]
**Tests added/modified:** [count and names]
**Tests passing:** [yes/no, count]
**Deviations:** [anything that differed from the task, or "none"]
**Issues encountered:** [any problems, or "none"]
```

### 4. Max nesting depth: 1

Sub-agents CANNOT delegate to their own sub-agents. If a sub-task is complex enough to need further delegation, it should be broken into separate delegations at the Thing level, or escalated to the orchestrator as separate chunks.

### 5. No coordination file access

Sub-agents do NOT:
- Post to the Notion Handoff Page
- Update `tasks/active-chunks.md`
- Update `tasks/todo.md`
- Modify `tasks/lessons.md` (they can suggest lessons; the Thing writes them)

These are the Thing's responsibilities. Sub-agents focus exclusively on implementation.

### 6. No git operations

Sub-agents should NOT commit, push, or create branches. The Thing reviews all sub-agent work and commits as a single coherent unit per chunk.

---

## Using the /delegate command

The `/delegate` slash command generates a properly scoped Task prompt. Usage:

```
/delegate <brief description of the sub-task>
```

It produces a structured Task block that includes:
- Task description with explicit scope
- Relevant recon context (pre-fetched by the Thing if available)
- File boundaries (read, modify, do not touch)
- Do NOT list
- Return format instructions

Review the generated Task block before executing. Adjust file boundaries and prohibitions as needed.

---

## Resolving sub-agent conflicts

When multiple sub-agents modify related code:

1. **Review all sub-agent results** before committing anything
2. **Check for overlapping file modifications** — if two sub-agents touched the same file, manually review and merge
3. **Run the full test suite** after integrating all sub-agent work
4. **If conflicts exist**, resolve them at the Thing level. Do not re-delegate the merge — you have the full context of both sub-agents' work.

---

## Updating active-chunks.md

The Thing (not sub-agents) maintains `tasks/active-chunks.md`:

**When starting a chunk:**
```
## Active
- Thing [N]: Chunk 16 — SyncOrchestrator polling (started 2:15pm)
```

**When delegating:**
```
## Active
- Thing [N]: Chunk 16 — SyncOrchestrator polling (started 2:15pm)
  - Sub-agent: implementing fetchUsage in ElevenLabsClient.swift
  - Sub-agent: writing SyncOrchestrator tests
```

**When chunk completes:**
Move to completed, clear sub-agent lines.

---

## Example delegation

The Thing receives a chunk spec to implement a new API client with tests.

**Thing's decision:** The client implementation and the test file are independent. Delegate both, then integrate.

**Delegation 1:**
```
Task: "Implement ElevenLabsClient conforming to ProviderClient protocol in 
Sources/Infrastructure/ElevenLabsClient.swift.

Read for context:
- Sources/Domain/ProviderClient.swift (protocol definition)
- Sources/Domain/DTOs.swift (CostSnapshotDTO, UsageRecordDTO)

Modify ONLY:
- Sources/Infrastructure/ElevenLabsClient.swift

Do NOT:
- Modify any other file
- Add new dependencies to Package.swift
- Change the ProviderClient protocol
- Post to Notion or update tasks/

Run /recon on ElevenLabsClient.swift before starting if it exists.

Return your results in this format:
## Sub-agent result
**Task:** ...
**Completed:** ...
**Files modified:** ...
**Tests added/modified:** ...
**Tests passing:** ...
**Deviations:** ...
**Issues encountered:** ..."
```

**Delegation 2:**
```
Task: "Write tests for ElevenLabsClient in Tests/ElevenLabsClientTests.swift.

Read for context:
- Sources/Infrastructure/ElevenLabsClient.swift
- Tests/AnthropicClientTests.swift (for test patterns and conventions)

Modify ONLY:
- Tests/ElevenLabsClientTests.swift

Do NOT:
- Modify source files
- Modify other test files
- Post to Notion or update tasks/

Return your results in the standard sub-agent format."
```

**After both return:** Thing reviews results, runs full test suite, resolves any issues, commits, and posts the handoff.
