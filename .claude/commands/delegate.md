# /delegate — Generate Scoped Sub-Agent Task

Generate a properly scoped Task block for delegating work to a sub-agent. The output is a ready-to-execute Task prompt with explicit boundaries, recon instructions, and return format.

**Usage:** `/delegate <brief description of the sub-task>`

---

## Procedure

### Step 1: Analyze the delegation request

From the description, determine:
1. **What files need to be read** for context (protocols, types, existing implementations the sub-agent needs to understand)
2. **What files will be modified** (the actual deliverables)
3. **What files must NOT be touched** (adjacent files that are out of scope, files another sub-agent is working on)
4. **What recon is needed** (check `.recon/knowledge.json` and `.recon/failures.json` for the target files)

### Step 2: Check for conflicts

Before generating the Task:
1. Read `tasks/active-chunks.md` — is another sub-agent currently working on overlapping files?
2. Check `.recon/failures.json` — are any target files blocked? If so, warn and suggest escalation instead of delegation.

If conflicts exist, report them and ask for guidance before proceeding.

### Step 3: Pre-fetch recon context (optional)

If the target files have entries in `.recon/knowledge.json`, include a brief summary in the Task block so the sub-agent has a head start. This saves the sub-agent from re-running full recon on already-analyzed files.

### Step 4: Generate the Task block

```
Task: "[Description of what needs to be done]

Read for context:
- [file path] ([why — protocol definition, type definitions, test patterns, etc.])
- [file path] ([why])

Modify ONLY:
- [file path]
- [file path]

Do NOT:
- Modify any file not listed under 'Modify ONLY'
- [Project-specific prohibitions relevant to this sub-task]
- Add new dependencies without explicit approval
- Post to Notion or update any files in tasks/
- Commit to git
- Spawn sub-agents (you are a sub-agent; max nesting depth is 1)

Recon: Run /recon on [target files] before modifying them if they have dependents, failure history, or you're changing exported interfaces.

[OPTIONAL — include if recon data exists:]
Recon context (pre-fetched):
- [file]: [N] exports, imported by [N] files, [failure status]

Return your results in this format:
## Sub-agent result
**Task:** [restate what was asked]
**Completed:** [what was actually done]
**Files modified:** [list with brief description of changes]
**Tests added/modified:** [count and names]
**Tests passing:** [yes/all pass / no/details]
**Deviations:** [anything different from the task, or 'none']
**Issues encountered:** [problems or blockers, or 'none']"
```

### Step 5: Update active-chunks.md

After the Task is accepted and begins execution, update `tasks/active-chunks.md` to reflect the active sub-agent:

```
- Thing: Chunk [N] — [Title] (started [time])
  - Sub-agent: [brief description of delegated task]
```

### Step 6: Present for review

Show the generated Task block and ask:
```
Generated delegation for: [description]
  Target files: [list]
  Excluded files: [list]
  
Ready to execute? (Review the Task block above and adjust if needed.)
```

Wait for confirmation before executing the Task.
