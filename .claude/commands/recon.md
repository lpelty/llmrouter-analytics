# /recon — Codebase Reconnaissance

Run a read-only analysis of a target file before making changes. Maps dependencies, checks failure history, and caches results across sessions.

**Usage:** `/recon <file_path>` or `/recon <directory>`

---

## Constraints

You are strictly read-only during recon. You may ONLY use:
- Read, Glob, Grep
- Bash with read-only commands: `git log`, `git diff`, `git blame`, `wc`, `find`, `cat`

You must NEVER use: Write, Edit, NotebookEdit, or any state-changing commands during recon.

---

## Procedure

### Step 1: Initialize

If `.recon/` doesn't exist at the project root, create it:
```bash
mkdir -p .recon
```

Create empty files if they don't exist:
- `.recon/knowledge.json`: `{ "version": 1, "last_updated": null, "project_patterns": null, "files": {} }`
- `.recon/failures.json`: `{ "version": 1, "last_updated": null, "entries": {} }`

Read both files into context.

### Step 2: Resolve Target

If the argument is a directory, list source files in it (exclude test files, node_modules, build output). For a single file, proceed directly.

### Step 3: Cache Check

For the target file:
1. Get the current SHA: `git log -1 --format="%h" -- <file_path>`
2. Look up `.recon/knowledge.json` → `files[<file_path>]`
3. If entry exists AND `last_modified_sha` matches current SHA → **CACHE HIT** (use cached exports/imports, skip to Step 5)
4. Otherwise → **CACHE MISS** (proceed to Step 4)

### Step 4: Full File Analysis (Cache Miss Only)

Read the target file and extract:

**Exports** — what the file exposes:
- TypeScript/JS: `grep -n "export " <file>` and `grep -n "module.exports" <file>`
- Python: top-level `def`, `class`, uppercase constants; check `__all__`
- Rust: `grep -n "pub fn\|pub struct\|pub enum\|pub trait" <file>`
- Go: capitalized identifiers (`grep -n "^func [A-Z]\|^type [A-Z]" <file>`)

**Imports** — what the file depends on:
- TypeScript/JS: `grep -n "import \|require(" <file>`
- Separate local imports (start with `.`) from package imports
- For local imports, read the imported file's exports to understand the interface

**Classification** — categorize the file:
- `pure_function`: No side effects, no I/O
- `utility`: Helpers, formatters, parsers
- `handler`: HTTP/event handlers
- `service`: Business logic with external deps
- `component`: UI component
- `type_definition`: Types/interfaces only
- `infrastructure`: Config, setup, DB connections

**Complexity**: `low` (< 100 lines), `medium` (100-300), `high` (> 300)

### Step 5: Find Dependents (Always Run)

This is the critical step — find every file that imports from the target:

```bash
# Adjust patterns for the project's language
grep -rn "from ['\"].*<target_module>['\"]" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" . | grep -v node_modules | grep -v ".recon"
```

For each dependent, note which exports it uses. These are the files that break if the target's interface changes.

### Step 6: Find Test Coverage

```bash
find . -name "*<basename>.test.*" -o -name "*<basename>.spec.*" -o -name "*<basename>_test.*" -o -name "test_<basename>.*" | grep -v node_modules
```

If found, read the test file. Identify which exports are tested and which are not.

### Step 7: Detect Project Patterns (First Run Only)

If `knowledge.json` has no `project_patterns`, read 1-2 existing test files to detect:
- Test framework (vitest, jest, pytest, etc.)
- Structure (describe/it, test(), #[test])
- Assertion style
- Mocking approach

Cache in `project_patterns`.

### Step 8: Check Failure Memory

Look up the target in `.recon/failures.json` → `entries[<file_path>]`:
- **No entry**: Clean — no previous failures
- **Active**: Include all attempts in output with "DO NOT repeat" warnings
- **Blocked** (3+ failures): Warn prominently — suggest human intervention or fundamentally different approach

### Step 9: Generate Recommendations

Based on all context:
1. If the target's interface needs changing AND dependents exist → recommend updating dependents too or changing the interface carefully
2. If related files in failure memory → recommend fixing those first
3. If untested exports exist → flag as test candidates
4. If high complexity → suggest incremental changes

### Step 10: Output

Print the recon report:

```
┌─ Recon: <file_path> ───────────────────────────┐
│ Cache: <HIT|MISS|NEW> (<detail>)               │
│ Exports: <N> functions, <N> types              │
│ Imported by: <N> files                         │
│ Test coverage: <none|partial|full>             │
│ Previous failures: <N> (<status>)              │
└────────────────────────────────────────────────┘

## Exports
- <name>(<params>): <return_type>

## Imported By (CHANGE THESE → BREAK THESE)
- <file_path> (uses <export1>, <export2>)

## Dependencies
- <import_path> → <what's used>

## Test Coverage
- Test file: <path or "none found">
- Tested: <list>
- Untested: <list>

## Project Patterns
- Framework: <detected>
- Style: <describe/it, test(), etc.>

## ⚠ Previous Failures (if any)
- [<date>] Approach: <what was tried>
  Error: <error detail>
  ❌ DO NOT repeat this approach
  → Try instead: <alternative suggestion>

## Recommendations
1. <actionable recommendation>
2. <actionable recommendation>
```

### Step 11: Update Cache

Write any cache-miss analysis back to `.recon/knowledge.json`. Update `last_updated`.

---

## After Failed Code Changes

When a coding attempt fails (tests break, type errors, build errors), log the failure BEFORE the next attempt:

1. Read `.recon/failures.json`
2. Add an entry for the target file:
   ```json
   {
     "timestamp": "<now>",
     "approach": "<plain English description of what was tried>",
     "error_category": "<type_error|import_error|runtime_error|test_failure|build_error|lint_error|logic_error|scope_creep>",
     "error_detail": "<error message + root cause analysis>",
     "related_files": ["<files involved but not modified>"],
     "files_modified": ["<files that were changed>"],
     "session_id": "session-<YYYY-MM-DD-HH>"
   }
   ```
3. If total_attempts >= 3 with same error_category → set status to "blocked"
4. Write updated file

The `scope_creep` category is for when fixing file A broke file B — it means the dependency graph wasn't fully understood before coding.
