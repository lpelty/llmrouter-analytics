# /recon-status — Reconnaissance Status

Show the current state of the knowledge graph and failure memory for this project.

**Usage:** `/recon-status`

---

## Procedure

### Step 1: Read State Files

Read `.recon/knowledge.json` and `.recon/failures.json`. If `.recon/` doesn't exist, report "No recon data — run `/recon <file>` to start."

### Step 2: Knowledge Graph Summary

For each entry in `knowledge.files`:
```bash
current_sha=$(git log -1 --format="%h" -- "<file_path>" 2>/dev/null)
```

Categorize each entry:
- **Fresh**: File exists AND cached SHA matches current SHA
- **Stale**: File exists AND SHA mismatch (needs re-scan on next `/recon`)
- **Orphaned**: File no longer exists (candidate for pruning)

### Step 3: Failure Memory Summary

Count entries by status:
- **Active**: Can be re-attempted (with failure context injected)
- **Blocked**: 3+ failures, needs human intervention or different strategy
- **Resolved**: Previously failed, now fixed

### Step 4: Output

```
┌─ Recon Status ──────────────────────────────────┐
│ Knowledge graph: <N> files cached               │
│   Fresh: <N>  Stale: <N>  Orphaned: <N>        │
│ Failure memory: <N> entries                     │
│   Active: <N>  Blocked: <N>  Resolved: <N>     │
│ Last recon: <timestamp or "never">              │
└─────────────────────────────────────────────────┘
```

If there are blocked entries, list them:
```
⛔ Blocked files:
  - <file_path> (<N> attempts, last error: <category>)
  - <file_path> (<N> attempts, last error: <category>)
```

If there are orphaned entries, offer to prune:
```
🗑 Orphaned entries (files no longer exist):
  - <file_path>
  Run `/recon-status --prune` to remove these.
```

### Step 5: Prune (if --prune flag)

If the user ran `/recon-status --prune`:
1. Remove entries from `knowledge.json` where the file no longer exists
2. Remove entries from `failures.json` where the file no longer exists
3. Report what was removed
