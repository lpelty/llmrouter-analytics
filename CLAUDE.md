# LLMRouter Analytics Dashboard — Claude Code Instructions

**Thing designation:** Thing 7
**Orchestrator:** Dispatch

Read this file at the start of every session.

## What this project is

A lightweight, self-hosted web dashboard that monitors LLMRouter routing decisions in real time. It tails the router log file, parses routing decisions (which model tier handled each request and why), and presents them visually — tier distribution, message type breakdown, cost estimates, misrouting flags, and a live decision stream. Two-part architecture: a Python backend that reads the log and serves JSON, and a single-file HTML frontend that polls and renders. Runs on localhost on Larry's Mac Mini alongside Lyra's infrastructure. Not a cloud service, not a database-backed app — just a log parser with a pretty face.

## Tech stack

- **Backend:** Python 3.10+ — standard library only (http.server, json, re, os). No pip installs.
- **Frontend:** Single HTML file — vanilla HTML/CSS/JS. Chart.js via CDN is acceptable for visualizations.
- **No build tools.** No npm, no bundler, no Docker, no venv.
- **Run command:** `python3 routing-analytics-server.py`
- **Port:** 9100 (configurable at top of server file)

## Architecture

The server reads a log file, parses it into structured routing decisions, and serves JSON to a browser frontend that polls every 5-10 seconds.

```
┌─────────────────┐         ┌──────────────────────┐
│  lyra-router.log │ ──────> │  Python HTTP Server   │
│  (append-only)   │  read   │  (localhost:9100)      │
└─────────────────┘         │                        │
                            │  GET /                 │ ──> routing-analytics.html
                            │  GET /api/decisions    │ ──> parsed decisions JSON
                            │  GET /api/summary      │ ──> aggregated stats JSON
                            │  GET /api/health       │ ──> server health
                            └──────────────────────┘
                                      │
                                      │ polls every 5-10s
                                      ▼
                            ┌──────────────────────┐
                            │  Browser (localhost)   │
                            │  - Tier distribution   │
                            │  - Message type matrix │
                            │  - Decision stream     │
                            │  - Cost estimates      │
                            │  - Misroute alerts     │
                            └──────────────────────┘
```

**Key constraint:** The server is read-only. It never writes to the log file or modifies router configuration.

## Critical: File placement rules

All repo-level files live at the **repo root**, NOT inside any build tool subdirectory.

```
routing-analytics/                   ← REPO ROOT
├── CLAUDE.md                        ← HERE
├── SUB_AGENTS.md                    ← Sub-agent delegation rules
├── .claude/commands/                ← Slash commands (recon, handoff, delegate, preflight)
├── .recon/                          ← Recon knowledge graph + failure memory
├── tasks/
│   ├── todo.md
│   ├── lessons.md
│   ├── active-chunks.md
│   └── doc-updates.md
├── routing-analytics-server.py      ← Python backend (single file)
├── routing-analytics.html           ← Frontend dashboard (single file)
└── README.md
```

If you find yourself creating CLAUDE.md, tasks/, or .claude/ inside a subdirectory, you are in the WRONG directory. Stop and fix it.

## Key data model decisions

### Log file format

The LLMRouter log file (`/Users/larrypelty/scripts/lyra-router.log`) uses `============` as block separators. Each block contains:

```
[Router] Strategy=llm -> tier_name
[Router] LLM error: error_message        (optional — classifier failures)
[Router] Query: 'message_content...' -> tier_name
INFO:     127.0.0.1:PORT - "POST /v1/chat/completions HTTP/1.1" 200 OK
```

Older entries use `Strategy=rules` instead of `Strategy=llm`. Both should be parsed.

### Message metadata stripping

Telegram messages include JSON metadata blocks that must be stripped to get the actual user message:

```
Conversation info (untrusted metadata):
\```json
{ ... }
\```

Sender (untrusted metadata):
\```json
{ ... }
\```
```

Strip these before displaying message previews.

### Message type classification

Classify messages by content inspection:
- `heartbeat` — contains "HEARTBEAT.md" or "HEARTBEAT_OK"
- `session_startup` — contains "Session Startup sequence" or "/new or /reset"
- `dream_cron` — contains "DREAM.md" or cron dream trigger
- `filename_slug` — contains "filename slug"
- `voice_note` — contains "[Audio]"
- `system_event` — contains "System:" or "Exec completed"
- `conversation` — everything else

### Tier pricing (per 1M tokens)

```python
PRICING = {
    "flash-lite": {"input": 0.25, "output": 1.5},
    "flash": {"input": 0.5, "output": 3.0},
    "sonnet": {"input": 3.0, "output": 15.0},
    # Legacy rules-based tier names
    "gemini-flash": {"input": 0.5, "output": 3.0},
    "gemini-flash-lite": {"input": 0.25, "output": 1.5},
}
```

### Misrouting rules

These define which tiers are acceptable for each message type:

```python
MISROUTE_RULES = {
    "heartbeat": ["flash-lite", "flash"],
    "session_startup": ["flash-lite", "flash"],
    "filename_slug": ["flash-lite"],
    "voice_note": ["flash", "sonnet"],
    "conversation": ["flash", "sonnet"],
    "dream_cron": ["sonnet"],
    "system_event": ["flash-lite", "flash", "sonnet"],
}
```

A routing decision is flagged as a misroute when the tier is NOT in the acceptable list for the message type.

## Conventions

- **Tests:** Not required for v1 (two-file project with no dependencies). If the project grows, add pytest for the parser logic.
- **Commits:** After each working feature. Message format: "Implement [feature] with [key behavior]"
- **Branch strategy:** main only for v1. Feature branches if complexity warrants it.
- **Never commit secrets.** The log path is a config constant, not a secret, but don't commit actual log files.

## Python-specific patterns

- **Standard library only.** Do not introduce pip dependencies. The `http.server` module handles HTTP. `json` handles serialization. `re` handles log parsing. If you think you need a library, find a stdlib solution instead.
- **Single-file backend.** Everything lives in `routing-analytics-server.py` — server, parser, API handlers. Don't split into modules unless the file exceeds ~500 lines.
- **Log reading strategy:** Read the full log file on each API request. The file is ~19K lines for weeks of data — fast enough for localhost. If this becomes a bottleneck, implement an in-memory cache with mtime-based invalidation.
- **Time window filtering:** The API accepts `?hours=N` to filter decisions. Parse all decisions, then filter by timestamp. If timestamps aren't extractable from the log (they may not be — the log format doesn't include explicit timestamps), use line position as a proxy or document the limitation.

## Frontend design direction

The dashboard should feel like a companion to the OpenClaw Control UI — dark theme, technical but not ugly. Design reference:

- **Dark background** — near-black or dark gray, not pure #000
- **Color-coded tiers:** Flash Lite = muted/gray, Flash = green/teal, Sonnet = amber/gold
- **Misroutes** in a warning color (red or coral)
- **Monospace for data,** proportional for labels
- **No framework.** Vanilla JS. Chart.js (via CDN) for charts if needed.
- **Single-page layout.** Summary cards at top, charts in middle, decision stream at bottom.
- **Auto-refreshing.** Poll the API every 5-10 seconds. Show a "last updated" timestamp.

## Recon protocol

This project uses a reconnaissance system to prevent blind code changes. Recon data lives in `.recon/` and is managed by the `/recon` and `/recon-status` slash commands.

**Purpose:** Map a file's exports, imports, dependents, test coverage, and failure history BEFORE modifying it. The goal is to know what breaks downstream before writing a single line of code.

### When to run recon automatically

Before modifying any file, run `/recon <target>` silently when ANY of these are true:

1. **Multiple dependents**: The target file is imported by 2 or more other files
2. **Failure history**: The target file has an entry in `.recon/failures.json`
3. **Interface change**: The planned change will modify exported function signatures, types, or class interfaces
4. **Unfamiliar file**: The target file has no entry in `.recon/knowledge.json`

Skip recon when ALL of these are true:
- The change is cosmetic (string literals, comments, formatting)
- The file has 0 dependents
- The file has no failure history
- You already ran recon on this file in the current session

### Failure logging (always active)

After any failed code change (tests fail, type errors, build errors):

1. STOP before retrying
2. Log the failure to `.recon/failures.json` (see `/recon` command for format)
3. Re-run `/recon <target>` to get updated context
4. Only then attempt a different approach

### Blocked file protocol

If a file has status `blocked` in `.recon/failures.json` (3+ failures with same error category):

1. Do NOT attempt to modify it without explicit user approval
2. Show the failure history and explain what's been tried
3. Suggest a fundamentally different approach — not a variation of previous attempts
4. If approved, inject ALL previous failure context before starting

### Relationship to tasks/lessons.md

`.recon/failures.json` is machine-readable failure memory — structured data parsed automatically to prevent retry loops. `tasks/lessons.md` is human-readable wisdom — prose patterns written after resolving issues. When a blocked file gets resolved, write the lesson to `lessons.md`.

## Context window management

Context is finite. Manage it deliberately:

- **Delegate heavy implementation** to sub-agents via `/delegate`. Keep this Thing's context lean for orchestration and chunk-level decisions.
- **Front-load critical context.** When starting a chunk, read the most important files first. Recon output and failure history take priority over implementation details.
- **Skip recon on low-risk files.** If a file has 0 dependents, no failure history, and you're making a self-contained change, you can skip `/recon` to preserve context.
- **Break large chunks.** If a chunk requires modifying 5+ files with interdependencies, ask the orchestrator to split it. Better to do two clean chunks than one that compacts mid-execution.
- **Sub-agent results are summaries.** When a sub-agent returns, you get the summary, not the full implementation context. This is a feature — it keeps your context clean.

## Sub-agent delegation

This project uses sub-agents for parallelism and context management. Read `SUB_AGENTS.md` for the full delegation protocol. Use `/delegate` to generate properly scoped sub-agent tasks.

Key rules:
- Max nesting depth: 1 (sub-agents cannot spawn their own sub-agents)
- Every delegation includes explicit file boundaries and a Do NOT list
- Sub-agents do NOT post handoffs or update coordination files
- The Thing resolves conflicts between sub-agent outputs before committing

## After completing a chunk

Run `/handoff` to generate and post the structured handoff entry.

Handoff destination (Notion):
Page URL: https://www.notion.so/Claude-Code-Handoff-LLMRouter-Analytics-32e1099a9e0781158b44f18f46bba025

If Notion MCP is unavailable, write to `tasks/doc-updates.md` as a fallback.

## Do NOT

- Skip recon on files with failure history — the failures happened for a reason
- Modify a file's exported interface without first checking what imports it
- Retry the same approach that already failed — the failure log exists for a reason
- Delete or reset `.recon/failures.json` to get around blocks
- Create CLAUDE.md, tasks/, or .claude/ inside a build subdirectory
- Post handoffs from sub-agents — only the Thing posts handoffs
- Spawn sub-agents from within a sub-agent (max depth: 1)
- Renumber chunks or use sub-chunk letters (3A, 3B) — use the next sequential integer
- Introduce pip dependencies — standard library only for the backend
- Write to the router log file — this tool is strictly read-only
- Commit actual log files to the repo — they contain conversation content
- Use a frontend framework (React, Vue, etc.) — vanilla JS only
