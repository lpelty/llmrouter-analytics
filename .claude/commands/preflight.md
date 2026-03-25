# /preflight — Pre-Flight Setup Verification

Verify that the project's Claude Code environment is correctly configured before starting work. Run this once after bootstrapping and again if something seems broken.

**Usage:** `/preflight`

---

## Procedure

### Step 1: Check file structure

Verify these files exist at the repo root:

```bash
for f in CLAUDE.md SUB_AGENTS.md .claude/settings.json .claude/commands/recon.md .claude/commands/recon-status.md .claude/commands/handoff.md .claude/commands/delegate.md tasks/todo.md tasks/lessons.md tasks/active-chunks.md tasks/doc-updates.md; do
  if [ -f "$f" ]; then
    echo "✓ $f"
  else
    echo "✗ $f — MISSING"
  fi
done

if [ -d ".recon" ]; then
  echo "✓ .recon/"
else
  echo "✗ .recon/ — MISSING (create with: mkdir -p .recon)"
fi
```

### Step 2: Check permissions

Verify `.claude/settings.json` exists and has the expected structure:

```bash
if [ -f ".claude/settings.json" ]; then
  echo "✓ settings.json exists"
  # Check for allow and deny sections
  if grep -q '"allow"' .claude/settings.json && grep -q '"deny"' .claude/settings.json; then
    echo "✓ settings.json has allow/deny sections"
  else
    echo "⚠ settings.json may be malformed — check allow/deny sections"
  fi
else
  echo "✗ settings.json — MISSING"
fi
```

### Step 3: Check git

```bash
if git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
  echo "✓ Git repository detected"
  echo "  Branch: $(git branch --show-current)"
  echo "  Last commit: $(git log -1 --oneline 2>/dev/null || echo 'no commits yet')"
else
  echo "✗ Not a git repository"
fi
```

### Step 4: Check slash commands

Verify the slash commands are discoverable by listing the `.claude/commands/` directory:

```bash
echo "Slash commands available:"
ls -1 .claude/commands/*.md 2>/dev/null | while read f; do
  name=$(basename "$f" .md)
  echo "  /$name"
done
```

Note: If Claude Code doesn't recognize a slash command on first use, try restarting the session. This is a known initialization issue.

### Step 5: Check Notion MCP (if configured)

If CLAUDE.md contains a Notion Handoff Page URL:

1. Attempt to read the Handoff Page via Notion MCP
2. If successful: `✓ Notion MCP connected — Handoff Page accessible`
3. If failed: `⚠ Notion MCP not available — handoffs will go to tasks/doc-updates.md`

This is not a blocking failure — the doc-updates.md fallback works.

### Step 6: Check recon state

```bash
if [ -f ".recon/knowledge.json" ]; then
  entries=$(grep -c '"files"' .recon/knowledge.json 2>/dev/null || echo "0")
  echo "✓ Recon knowledge cache exists"
else
  echo "○ No recon cache yet — will be created on first /recon run"
fi

if [ -f ".recon/failures.json" ]; then
  blocked=$(grep -c '"blocked"' .recon/failures.json 2>/dev/null || echo "0")
  echo "✓ Recon failure memory exists (blocked files: $blocked)"
else
  echo "○ No failure memory yet — will be created if failures occur"
fi
```

### Step 7: Check CLAUDE.md completeness

Scan CLAUDE.md for unfilled template markers:

```bash
fills=$(grep -c "\[FILL" CLAUDE.md 2>/dev/null || echo "0")
if [ "$fills" -gt 0 ]; then
  echo "⚠ CLAUDE.md has $fills unfilled [FILL] markers:"
  grep -n "\[FILL" CLAUDE.md
else
  echo "✓ CLAUDE.md has no unfilled markers"
fi
```

### Step 8: Report

Print a summary:

```
┌─ Preflight Report ────────────────────────────────┐
│ File structure:    [✓ complete / ✗ N missing]     │
│ Permissions:       [✓ configured / ✗ missing]     │
│ Git:               [✓ active / ✗ not a repo]     │
│ Slash commands:    [N] available                  │
│ Notion MCP:        [✓ connected / ⚠ unavailable] │
│ Recon state:       [✓ cached / ○ fresh]          │
│ CLAUDE.md:         [✓ complete / ⚠ N unfilled]   │
└───────────────────────────────────────────────────┘
```

If any critical items are missing (file structure, permissions, git), list the fix commands.

If everything passes: `Ready to receive chunk specs.`
