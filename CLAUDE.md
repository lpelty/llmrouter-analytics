# CLAUDE.md — LLMRouter Analytics Dashboard (Thing 7)
**Version:** 3.0
**Last Updated:** March 30, 2026
**Orchestrator:** Dispatch (AI Chief of Staff)
**Owner:** Larry Paul Pelty, Jr.

---

## What You're Building

A lightweight, self-hosted web dashboard that monitors LLMRouter routing decisions in real time. It reads the router log file, parses routing decisions, and presents them visually so Larry can tell at a glance whether routing is working correctly and where money is going.

**This is NOT Buildmeter** (Kestrel's project — that's fleet-wide cost tracking). This tool is specifically about LLMRouter *routing intelligence*.

---

## Architecture

### Backend: Python HTTP Server
- **File:** `routing-analytics-server.py`
- **Port:** 9100 (configurable)
- **Dependencies:** Python 3.10+ standard library only (zero pip installs)
- **Endpoints:**
  - `GET /` — serves built frontend (static files from `frontend/dist/`)
  - `GET /api/decisions?hours=24` — returns parsed routing decisions as JSON
  - `GET /api/summary?hours=24` — returns aggregated stats
  - `GET /api/health` — server health check
- **Data source:** `/Users/larrypelty/scripts/lyra-router.log` (read-only, never write)

### Frontend: React + Tailwind CSS v4 + shadcn/ui
- **Directory:** `frontend/`
- **Stack:** React 19, Tailwind CSS v4, shadcn/ui (Radix primitives), Recharts
- **Build:** Vite → outputs to `frontend/dist/` → served by Python backend
- **Runtime:** `python3 serve.py` and open browser. Node.js is only for development builds.

### Development Workflow
```bash
# Development (hot reload)
cd frontend && npm run dev          # Vite dev server on :5173
python3 routing-analytics-server.py  # API server on :9100
# Vite proxies /api/* to :9100 during development

# Production
cd frontend && npm run build         # Outputs to dist/
python3 routing-analytics-server.py  # Serves dist/ + API on :9100
```

---

## The 4-Tier Routing Model

LLMRouter v6.0 uses `strategy: llm` with a Grok 4.1 Fast (non-reasoning) classifier. Four backend tiers:

| Tier | Model | Cost (input/output per 1M) | Color | Purpose |
|------|-------|---------------------------|-------|---------|
| Flash Lite | `google/gemini-3.1-flash-lite-preview` | $0.25 / $1.50 | Gray `#7A7A8C` | Mechanical: classifier calls, heartbeat routing |
| Flash | `google/gemini-3-flash-preview` | $0.50 / $3.00 | Blue `#60A5FA` | Tool calls: simple reads, lookups, status checks |
| Grok | `x-ai/grok-4.1-fast` | $0.20 / $0.50 | Green `#4ADE80` | Companion: conversation, personality, blended requests |
| Sonnet | `anthropic/claude-sonnet-4-6` | $3.00 / $15.00 | Purple `#C084FC` | Last resort: complex reasoning, creative, multi-step analysis |

**Misroute color:** Coral red `#E6495A`

**Key routing facts:**
- Grok is the companion tier — most conversation goes here. It's cheaper than Flash on output tokens.
- Sonnet is the LAST RESORT tier. If heartbeats, dreams, or simple tool calls hit Sonnet, that's a misroute.
- Flash handles tool-call-only requests (no conversation wrapping).
- Flash Lite handles the classifier itself and mechanical tasks.
- Heartbeat has a model override (`openrouter/google/gemini-3-flash-preview`) that bypasses the router entirely.

---

## Message Type Classification

Derived from message content in the router log:

| Type | Detection Pattern | Expected Tier |
|------|------------------|---------------|
| `heartbeat` | Contains "HEARTBEAT.md" or "HEARTBEAT_OK" | Flash (override) |
| `session_startup` | Contains "Session Startup sequence" or "/new" | Flash or Flash Lite |
| `dream_cron` | Contains "DREAM.md" or cron dream trigger | Grok |
| `exploration` | Contains exploration trigger patterns | Grok |
| `task_worker` | Contains "TASKS.md" or task worker trigger | Flash → Sonnet (escalates) |
| `filename_slug` | Contains "filename slug" | Flash Lite |
| `voice_note` | Contains "[Audio]" | Grok |
| `system_event` | Contains "System:" or "Exec completed" | Flash Lite |
| `conversation` | Everything else | Grok |

---

## Router Log Format

**Path:** `/Users/larrypelty/scripts/lyra-router.log`

Blocks separated by `============` dividers. Each block contains:
```
[Router] Strategy=llm -> tier_name
[Router] LLM error: error_message                       (classifier failures)
[Router] Query: 'message_content...' -> tier_name
INFO:     127.0.0.1:PORT - "POST /v1/chat/completions HTTP/1.1" 200 OK
```

**Tier names in log:** `flash-lite`, `flash`, `grok`, `sonnet`

**Message metadata:** Messages from Telegram include JSON metadata blocks (conversation info, sender info) wrapped in triple-backtick fences. Strip these to extract the actual user message for display.

---

## UI Design Spec (v4.1)

Design file: `llmrouter-analytics.pen` in repo root. v4.1 is the current target. The .pen file contains v1 through v4.1 as an iterative design trail — v4.1 is what to build.

### Layout Structure
```
┌─────────────────────────────────────────────────────┐
│ Header: Title | [Rolling: 24h 7d 30d] | [To-now:    │
│                 Today WTD MTD YTD]    | ● Live 3m   │
├─────────────────────────────────────────────────────┤
│ ⚠ Alert Banner (hero when misroutes exist)          │
│   "8 misroutes detected — 7.6% of traffic"          │
│   "Heartbeats routing to Sonnet..."    [View Details]│
├─────────────────────────────────────────────────────┤
│ [Total Decisions] [Estimated Cost] [Misroute Rate]  │
│   419               $9.42             7.6%          │
├──────────────────────────────┬──────────────────────┤
│ Tier Distribution            │ Recent Decisions     │
│ ████████████████████████████ │ ┌──────────────────┐ │
│ Grok 54% Flash 23% Son 13%  │ │ Grok conversation │ │
│                              │ │ "Hey Lyra, can..."│ │
│ Message Type × Tier          │ ├──────────────────┤ │
│ ┌────────────────────────┐   │ │ Flash tool_call   │ │
│ │ Type    Grok Flash Son │   │ │ "Read HEARTBEAT.."│ │
│ │ heartbt  3    1   *2*  │   │ ├──────────────────┤ │
│ │ convers  64   —    —   │   │ │ Sonnet heartbeat  │ │
│ │ tool_cl  —    15   2   │   │ │ MISROUTE          │ │
│ │ reason   —    —    8   │   │ │ Expected: Lite    │ │
│ │ dream    1    —    —   │   │ └──────────────────┘ │
│ └────────────────────────┘   │      View all →      │
└──────────────────────────────┴──────────────────────┘
```

### Time Period Selectors
Two mutually exclusive groups separated by a visual divider:
- **Rolling periods:** 24h, 7d, 30d (how far back from now)
- **To-now periods:** Today, WTD (Week to Date), MTD (Month to Date), YTD (Year to Date)
Only one selection active at a time. Active tab has filled background; inactive tabs are text-only.

### Typography
- **Geist** — headings, metric values (large numbers)
- **Inter** — body text, labels, descriptions
- **IBM Plex Mono** — data values, code, table content, tier labels

### Component Plan (shadcn/ui)
- Card — metric summary cards, chart containers
- Table — message type × tier matrix
- Badge — tier tags, message type tags, misroute flags
- Tabs — time period selector (custom: two tab groups)
- Alert — misroute and error rate alerts
- Tooltip — detail on hover for truncated messages
- ScrollArea — scrollable decision stream

### Dark Theme Surface System
- Background: `#111115`
- Card/panel: `#19191F`
- Elevated surface: `#22222A`
- Border: `#33333F`
- Muted text: `#7A7A8C`
- Secondary text: `#A0A0B0`
- Primary text: `#F5F5FA`

### Tier Distribution Bar
Full-width horizontal stacked bar representing 100% of traffic. Each segment is proportional to the tier's percentage. If only one tier received traffic, the bar is 100% that color. Legend below shows: tier name, percentage, and estimated cost.

### Matrix Design
- Only show rows with actual routing activity (no empty rows)
- Misroute cells highlighted in red with bold text
- Status column with "clean" (green) or "N misrouted" (red) tags
- Misroute rows get a subtle red background tint

### Decision Stream
- 3-4 most recent entries visible
- Each entry: tier color pill + message type (mono) + relative timestamp
- Message preview below (1 line, truncated)
- Misroute entries: red border, "MISROUTE" badge, "Expected: X → Routed: Y" line
- "View all →" link at panel header

---

## Misrouting Rules

A decision is flagged as a misroute when:
- `heartbeat` → anything other than `flash` (has model override, but monitor)
- `session_startup` → `sonnet` or `grok`
- `filename_slug` → anything other than `flash-lite`
- `conversation` → anything other than `grok`
- `voice_note` → anything other than `grok`
- `dream_cron` → `sonnet` (should be `grok` per Session 13 tightening)
- `exploration` → `sonnet` (should be `grok`)
- `tool_call` (simple read) → `sonnet`

These rules should be configurable in the Python backend (a config dict, not hardcoded throughout).

---

## Cost Estimation

Estimated cost per decision = (avg_input_tokens × input_price + avg_output_tokens × output_price) per tier.

Default token estimates (refine from real data later):
- Flash Lite: ~600 input, ~100 output (classifier calls)
- Flash: ~2,000 input, ~200 output (tool calls)
- Grok: ~4,000 input, ~500 output (conversation)
- Sonnet: ~8,000 input, ~1,000 output (reasoning)

These are rough — the dashboard should make them configurable.

---

## Project Structure
```
llmrouter-analytics/
├── routing-analytics-server.py    ← Python backend
├── llmrouter-analytics.pen        ← Pencil.dev design file (v1-v4.1)
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── components.json              ← shadcn/ui config
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── ui/                   ← shadcn/ui components (owned)
│   │   │   ├── dashboard/            ← dashboard-specific components
│   │   │   └── ...
│   │   ├── lib/
│   │   │   ├── api.ts                ← API client (polling, data fetching)
│   │   │   ├── types.ts              ← TypeScript types for routing data
│   │   │   └── utils.ts              ← shadcn cn() utility
│   │   └── index.css                 ← Tailwind + shadcn theme tokens
│   └── dist/                         ← Built output (served by Python)
├── CLAUDE.md                         ← This file
├── SUB_AGENTS.md
├── tasks/
└── .recon/
```

---

## Key Reference Files

| Resource | Location |
|----------|----------|
| LLMRouter config | `/Users/larrypelty/LLMRouter/configs/lyra.yaml` |
| Router log | `/Users/larrypelty/scripts/lyra-router.log` |
| Router error log | `/Users/larrypelty/scripts/lyra-router-error.log` |
| LaunchAgent plist | `~/Library/LaunchAgents/com.lyra.llmrouter.plist` |
| PRD (Notion) | https://www.notion.so/32e1099a9e07816592a6d707cd4e5d5c |
| Handoff page (Notion) | https://www.notion.so/32e1099a9e0781158b44f18f46bba025 |
| Design file | `llmrouter-analytics.pen` (repo root) |

---

## Chunk Workflow

1. Build in focused chunks. Each chunk = one logical unit of work.
2. After each chunk, write a handoff entry to the Notion handoff page.
3. Commit with descriptive messages.
4. Don't skip the frontend build step — Larry's runtime is `python3 serve.py`, not `npm run dev`.

### Suggested First Chunks
1. **Backend:** Python server that tails the log, parses decisions, serves JSON via `/api/decisions` and `/api/summary`
2. **Frontend scaffold:** Vite + React + Tailwind + shadcn/ui setup, dark theme tokens, proxy config
3. **Dashboard shell:** Header with time period selectors, metric cards, auto-polling
4. **Tier distribution + matrix:** Stacked bar and message type × tier table
5. **Decision stream + alerts:** Right panel with recent decisions, misroute alert banner

---

*CLAUDE.md Version 3.0 — March 30, 2026*
*v1.0: Initial handoff (Session 9)*
*v2.0: Frontend stack rewrite to React + Tailwind + shadcn/ui (Session 9)*
*v3.0: Updated for 4-tier routing (Grok companion), v4.1 design spec, time period selectors, updated misroute rules (Session 14)*
