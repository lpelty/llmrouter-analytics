#!/usr/bin/env python3
"""
LLMRouter Analytics Dashboard — Backend API Server
Parses lyra-router.log and serves routing decision analytics.

Port: 9100 (override with PORT env var)
Dependencies: Python 3.10+ stdlib only
"""

import json
import os
import re
import time
import mimetypes
from datetime import datetime, timezone, timedelta
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse, parse_qs

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

PORT = int(os.environ.get("PORT", 9100))
LOG_FILE = os.environ.get(
    "LLMROUTER_LOG", "/Users/larrypelty/scripts/lyra-router.log"
)
FRONTEND_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "frontend", "dist")

# Per-tier cost model (prices per 1M tokens)
TIER_CONFIG = {
    "flash-lite": {
        "label": "Flash Lite",
        "color": "#7A7A8C",
        "input_price": 0.25,
        "output_price": 1.50,
        "avg_input_tokens": 600,
        "avg_output_tokens": 100,
    },
    "flash": {
        "label": "Flash",
        "color": "#60A5FA",
        "input_price": 0.50,
        "output_price": 3.00,
        "avg_input_tokens": 2000,
        "avg_output_tokens": 200,
    },
    "grok": {
        "label": "Grok",
        "color": "#4ADE80",
        "input_price": 0.20,
        "output_price": 0.50,
        "avg_input_tokens": 4000,
        "avg_output_tokens": 500,
    },
    "grok-companion": {
        "label": "Grok Companion",
        "color": "#34D399",
        "input_price": 0.20,
        "output_price": 0.50,
        "avg_input_tokens": 4000,
        "avg_output_tokens": 500,
    },
    "sonnet": {
        "label": "Sonnet",
        "color": "#C084FC",
        "input_price": 3.00,
        "output_price": 15.00,
        "avg_input_tokens": 8000,
        "avg_output_tokens": 1000,
    },
}

# Message type classification patterns (checked in order; first match wins)
MESSAGE_TYPE_PATTERNS = [
    ("heartbeat", [r"HEARTBEAT\.md", r"HEARTBEAT_OK"]),
    ("session_startup", [r"Session Startup sequence", r"/new\b"]),
    ("dream_cron", [r"DREAM\.md", r"cron\s+dream"]),
    ("exploration", [r"exploration\s+trigger", r"explore\s+"]),
    ("task_worker", [r"TASKS\.md", r"task\s+worker\s+trigger"]),
    ("filename_slug", [r"filename\s+slug"]),
    ("voice_note", [r"\[Audio\]"]),
    ("system_event", [r"System:", r"Exec completed"]),
    # "conversation" is the fallback — handled in code
]

# Misroute rules: message_type -> set of ALLOWED tiers (v6.2 config)
# If the routed tier is not in the allowed set, it's a misroute.
MISROUTE_RULES: dict[str, set[str] | dict] = {
    "heartbeat": {"grok"},
    "session_startup": {"grok"},
    "filename_slug": {"grok"},
    "conversation": {"grok", "grok-companion", "sonnet"},
    "voice_note": {"grok-companion"},
    "dream_cron": {"grok-companion"},
    "exploration": {"grok"},
    "task_worker": {"grok", "grok-companion"},
    "system_event": {"grok", "grok-companion"},
}

# ---------------------------------------------------------------------------
# Log parser
# ---------------------------------------------------------------------------

_compiled_patterns: list[tuple[str, list[re.Pattern]]] | None = None


def _get_compiled_patterns() -> list[tuple[str, list[re.Pattern]]]:
    global _compiled_patterns
    if _compiled_patterns is None:
        _compiled_patterns = [
            (msg_type, [re.compile(p, re.IGNORECASE) for p in patterns])
            for msg_type, patterns in MESSAGE_TYPE_PATTERNS
        ]
    return _compiled_patterns


def classify_message(text: str) -> str:
    """Return the message type for a given query text."""
    for msg_type, compiled in _get_compiled_patterns():
        for pat in compiled:
            if pat.search(text):
                return msg_type
    return "conversation"


def is_misroute(message_type: str, tier: str) -> bool:
    """Return True if routing this message_type to this tier is a misroute."""
    allowed = MISROUTE_RULES.get(message_type)
    if allowed is None:
        return False  # no rule defined — assume OK
    return tier not in allowed


def strip_telegram_metadata(text: str) -> str:
    """Remove triple-backtick JSON metadata blocks from Telegram messages."""
    # Remove ```json ... ``` blocks
    cleaned = re.sub(r"```(?:json)?\s*\{[^`]*?\}\s*```", "", text, flags=re.DOTALL)
    return cleaned.strip()


def estimate_cost(tier: str, count: int = 1) -> float:
    """Estimate cost for `count` decisions routed to `tier`."""
    cfg = TIER_CONFIG.get(tier)
    if cfg is None:
        return 0.0
    input_cost = (cfg["avg_input_tokens"] / 1_000_000) * cfg["input_price"]
    output_cost = (cfg["avg_output_tokens"] / 1_000_000) * cfg["output_price"]
    return (input_cost + output_cost) * count


# Regex patterns for parsing log blocks
RE_STRATEGY = re.compile(r"\[Router\]\s+Strategy=(\S+)\s+->\s+(\S+)")
RE_QUERY = re.compile(r"\[Router\]\s+Query:\s+'(.+?)'\s+->\s+(\S+)")
RE_LLM_ERROR = re.compile(r"\[Router\]\s+LLM error:\s+(.+)")
RE_HTTP_LOG = re.compile(
    r"(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}(?:\.\d+)?)"  # timestamp (if present)
    r".*?INFO.*?POST\s+/v1/chat/completions"
)
# Match bracketed ISO timestamps: [2026-04-02T11:50:10]
RE_BRACKETED_TIMESTAMP = re.compile(
    r"\[(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})\]"
)
# Fallback: bare timestamp anywhere in the line
RE_TIMESTAMP_LINE = re.compile(
    r"(\d{4}-\d{2}-\d{2}[\sT]\d{2}:\d{2}:\d{2}(?:\.\d+)?)"
)
RE_SEPARATOR = re.compile(r"^={4,}", re.MULTILINE)


def _parse_timestamp(ts_str: str) -> datetime | None:
    """Try to parse a timestamp string into a datetime."""
    for fmt in (
        "%Y-%m-%d %H:%M:%S.%f",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%dT%H:%M:%S.%f",
        "%Y-%m-%dT%H:%M:%S",
    ):
        try:
            return datetime.strptime(ts_str, fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    return None


def parse_log_file(path: str) -> tuple[list[dict], int]:
    """
    Parse the router log file and return (decisions, classifier_error_count).
    Each decision dict: {timestamp, strategy, tier, query, message_type, misroute, expected_tier}
    """
    if not os.path.isfile(path):
        return [], 0

    try:
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            content = f.read()
    except OSError:
        return [], 0

    blocks = RE_SEPARATOR.split(content)
    decisions: list[dict] = []
    classifier_errors = 0

    for block in blocks:
        block = block.strip()
        if not block:
            continue

        # Check for classifier errors
        err_match = RE_LLM_ERROR.search(block)
        if err_match:
            classifier_errors += 1

        # Extract query and tier
        query_match = RE_QUERY.search(block)
        strategy_match = RE_STRATEGY.search(block)

        if not query_match and not strategy_match:
            continue

        tier = None
        strategy = None
        query = ""

        if strategy_match:
            strategy = strategy_match.group(1)
            tier = strategy_match.group(2)

        if query_match:
            query = query_match.group(1)
            tier_from_query = query_match.group(2)
            if tier is None:
                tier = tier_from_query

        if tier is None:
            continue

        # Normalize tier name
        tier = tier.lower().strip()

        # Try to extract a timestamp from the block
        # Prefer bracketed ISO format [2026-04-02T11:50:10] (new log format)
        timestamp = None
        ts_match = RE_BRACKETED_TIMESTAMP.search(block)
        if not ts_match:
            ts_match = RE_TIMESTAMP_LINE.search(block)
        if ts_match:
            timestamp = _parse_timestamp(ts_match.group(1))

        # If no timestamp found, use None (will be assigned approximate time)
        clean_query = strip_telegram_metadata(query)
        message_type = classify_message(clean_query)
        misroute = is_misroute(message_type, tier)

        # Determine expected tier for misroute display
        expected_tier = None
        if misroute:
            allowed = MISROUTE_RULES.get(message_type)
            if allowed:
                # Pick the first allowed tier as the "expected" one
                expected_tier = sorted(allowed)[0]

        decisions.append(
            {
                "timestamp": timestamp.isoformat() if timestamp else None,
                "strategy": strategy or "llm",
                "tier": tier,
                "query": clean_query[:500],  # truncate long queries
                "message_type": message_type,
                "misroute": misroute,
                "expected_tier": expected_tier,
            }
        )

    return decisions, classifier_errors


# ---------------------------------------------------------------------------
# Cache layer — avoid re-parsing the full log on every request
# ---------------------------------------------------------------------------

class LogCache:
    def __init__(self, log_path: str):
        self.log_path = log_path
        self._decisions: list[dict] = []
        self._classifier_errors: int = 0
        self._last_mtime: float = 0.0
        self._last_size: int = 0
        self._last_parse_time: float = 0.0

    def get_data(self) -> tuple[list[dict], int]:
        """Return (decisions, classifier_errors), re-parsing only if the file changed."""
        try:
            stat = os.stat(self.log_path)
            mtime = stat.st_mtime
            size = stat.st_size
        except OSError:
            return [], 0

        if mtime != self._last_mtime or size != self._last_size:
            self._decisions, self._classifier_errors = parse_log_file(self.log_path)
            self._last_mtime = mtime
            self._last_size = size
            self._last_parse_time = time.time()

        return self._decisions, self._classifier_errors

    @property
    def last_parse_time(self) -> float:
        return self._last_parse_time

    @property
    def log_exists(self) -> bool:
        return os.path.isfile(self.log_path)


_cache = LogCache(LOG_FILE)

# ---------------------------------------------------------------------------
# Time filtering helpers
# ---------------------------------------------------------------------------

def _filter_by_time(decisions: list[dict], params: dict[str, list[str]]) -> list[dict]:
    """
    Filter decisions by time parameters.
    Supports:
      - hours=N (rolling window)
      - start=ISO, end=ISO (absolute range)
      - period=today|wtd|mtd|ytd (to-now periods)
    """
    now = datetime.now(timezone.utc)

    # Check for period param (Today, WTD, MTD, YTD)
    period = (params.get("period") or [None])[0]
    if period:
        period = period.lower()
        if period == "today":
            start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        elif period == "wtd":
            # Week starts Monday
            start = now - timedelta(days=now.weekday())
            start = start.replace(hour=0, minute=0, second=0, microsecond=0)
        elif period == "mtd":
            start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        elif period == "ytd":
            start = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        else:
            start = now - timedelta(hours=24)
        return _filter_range(decisions, start, now)

    # Check for explicit start/end
    start_str = (params.get("start") or [None])[0]
    end_str = (params.get("end") or [None])[0]
    if start_str or end_str:
        start = _parse_timestamp(start_str) if start_str else datetime.min.replace(tzinfo=timezone.utc)
        end = _parse_timestamp(end_str) if end_str else now
        return _filter_range(decisions, start, end)

    # Default: rolling hours
    hours_str = (params.get("hours") or ["24"])[0]
    try:
        hours = float(hours_str)
    except ValueError:
        hours = 24.0
    cutoff = now - timedelta(hours=hours)
    return _filter_range(decisions, cutoff, now)


def _filter_range(decisions: list[dict], start: datetime, end: datetime) -> list[dict]:
    """Filter decisions whose timestamp falls within [start, end].
    Entries without timestamps (old log format) are excluded from filtered views.
    """
    result = []
    for d in decisions:
        ts_str = d.get("timestamp")
        if ts_str is None:
            # No timestamp — exclude from time-filtered views
            continue
        ts = datetime.fromisoformat(ts_str)
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        if start <= ts <= end:
            result.append(d)
    return result


# ---------------------------------------------------------------------------
# Summary computation
# ---------------------------------------------------------------------------

def compute_summary(decisions: list[dict], classifier_errors: int) -> dict:
    """Compute aggregated stats from a list of decisions."""
    total = len(decisions)

    # Tier distribution
    tier_counts: dict[str, int] = {}
    for d in decisions:
        tier = d["tier"]
        tier_counts[tier] = tier_counts.get(tier, 0) + 1

    tier_distribution = []
    total_cost = 0.0
    for tier_name in ("flash-lite", "flash", "grok", "grok-companion", "sonnet"):
        count = tier_counts.get(tier_name, 0)
        cost = estimate_cost(tier_name, count)
        total_cost += cost
        cfg = TIER_CONFIG.get(tier_name, {})
        tier_distribution.append(
            {
                "tier": tier_name,
                "label": cfg.get("label", tier_name),
                "color": cfg.get("color", "#888"),
                "count": count,
                "percentage": round(count / total * 100, 1) if total else 0,
                "estimated_cost": round(cost, 4),
            }
        )

    # Include any unknown tiers
    known = {"flash-lite", "flash", "grok", "grok-companion", "sonnet"}
    for tier_name, count in tier_counts.items():
        if tier_name not in known:
            cost = 0.0
            total_cost += cost
            tier_distribution.append(
                {
                    "tier": tier_name,
                    "label": tier_name,
                    "color": "#888",
                    "count": count,
                    "percentage": round(count / total * 100, 1) if total else 0,
                    "estimated_cost": 0.0,
                }
            )

    # Misroute stats
    misroutes = [d for d in decisions if d.get("misroute")]
    misroute_count = len(misroutes)
    misroute_rate = round(misroute_count / total * 100, 1) if total else 0

    # Message type x tier matrix
    matrix: dict[str, dict[str, int]] = {}
    matrix_misroutes: dict[str, dict[str, bool]] = {}
    for d in decisions:
        mt = d["message_type"]
        tier = d["tier"]
        if mt not in matrix:
            matrix[mt] = {}
            matrix_misroutes[mt] = {}
        matrix[mt][tier] = matrix[mt].get(tier, 0) + 1
        if d.get("misroute"):
            matrix_misroutes[mt][tier] = True

    # Build matrix rows (only rows with data)
    matrix_rows = []
    for mt in sorted(matrix.keys()):
        tier_cells = {}
        row_misroutes = 0
        for tier_name in list(known) + [t for t in matrix[mt] if t not in known]:
            count = matrix[mt].get(tier_name, 0)
            if count > 0:
                is_mis = matrix_misroutes.get(mt, {}).get(tier_name, False)
                tier_cells[tier_name] = {
                    "count": count,
                    "misroute": is_mis,
                }
                if is_mis:
                    row_misroutes += count
        matrix_rows.append(
            {
                "message_type": mt,
                "tiers": tier_cells,
                "total": sum(matrix[mt].values()),
                "misroute_count": row_misroutes,
                "status": "clean" if row_misroutes == 0 else f"{row_misroutes} misrouted",
            }
        )

    return {
        "total_decisions": total,
        "estimated_cost": round(total_cost, 4),
        "misroute_count": misroute_count,
        "misroute_rate": misroute_rate,
        "tier_distribution": tier_distribution,
        "matrix": matrix_rows,
        "classifier_errors": classifier_errors,
    }


# ---------------------------------------------------------------------------
# HTTP Handler
# ---------------------------------------------------------------------------

SERVER_START_TIME = time.time()


class AnalyticsHandler(SimpleHTTPRequestHandler):
    """HTTP request handler for the analytics API and frontend static files."""

    def log_message(self, format, *args):
        """Quieter logging."""
        pass  # Suppress default access logs; remove this line to re-enable

    def _set_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _send_json(self, data: dict | list, status: int = 200):
        body = json.dumps(data, indent=2).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self._set_cors_headers()
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self._set_cors_headers()
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"
        params = parse_qs(parsed.query)

        if path == "/api/decisions":
            self._handle_decisions(params)
        elif path == "/api/summary":
            self._handle_summary(params)
        elif path == "/api/health":
            self._handle_health()
        else:
            self._serve_static(path)

    # --- API Handlers ---

    def _handle_decisions(self, params: dict):
        decisions, _ = _cache.get_data()
        filtered = _filter_by_time(decisions, params)
        # Newest first
        filtered.sort(
            key=lambda d: d.get("timestamp") or "0000-00-00T00:00:00", reverse=True
        )
        self._send_json(filtered)

    def _handle_summary(self, params: dict):
        decisions, classifier_errors = _cache.get_data()
        filtered = _filter_by_time(decisions, params)
        summary = compute_summary(filtered, classifier_errors)
        self._send_json(summary)

    def _handle_health(self):
        self._send_json(
            {
                "status": "ok",
                "uptime_seconds": round(time.time() - SERVER_START_TIME, 1),
                "log_file": LOG_FILE,
                "log_exists": _cache.log_exists,
                "last_parse_time": (
                    datetime.fromtimestamp(_cache.last_parse_time, tz=timezone.utc).isoformat()
                    if _cache.last_parse_time > 0
                    else None
                ),
                "port": PORT,
            }
        )

    # --- Static file serving ---

    def _serve_static(self, path: str):
        """Serve static files from frontend/dist/."""
        if path == "/":
            path = "/index.html"

        file_path = os.path.join(FRONTEND_DIR, path.lstrip("/"))

        # Security: prevent path traversal
        real_path = os.path.realpath(file_path)
        real_base = os.path.realpath(FRONTEND_DIR)
        if not real_path.startswith(real_base):
            self.send_error(403, "Forbidden")
            return

        if os.path.isfile(real_path):
            mime_type, _ = mimetypes.guess_type(real_path)
            if mime_type is None:
                mime_type = "application/octet-stream"

            try:
                with open(real_path, "rb") as f:
                    content = f.read()
                self.send_response(200)
                self.send_header("Content-Type", mime_type)
                self._set_cors_headers()
                self.send_header("Content-Length", str(len(content)))
                self.end_headers()
                self.wfile.write(content)
            except OSError:
                self.send_error(500, "Internal Server Error")
        else:
            # SPA fallback: serve index.html for unmatched routes
            index_path = os.path.join(FRONTEND_DIR, "index.html")
            if os.path.isfile(index_path):
                try:
                    with open(index_path, "rb") as f:
                        content = f.read()
                    self.send_response(200)
                    self.send_header("Content-Type", "text/html")
                    self._set_cors_headers()
                    self.send_header("Content-Length", str(len(content)))
                    self.end_headers()
                    self.wfile.write(content)
                except OSError:
                    self.send_error(500, "Internal Server Error")
            else:
                self.send_error(404, "Not Found")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    HTTPServer.allow_reuse_address = True
    server = HTTPServer(("0.0.0.0", PORT), AnalyticsHandler)
    print(f"LLMRouter Analytics server starting on port {PORT}")
    print(f"  Log file: {LOG_FILE} ({'exists' if os.path.isfile(LOG_FILE) else 'NOT FOUND — will retry on requests'})")
    print(f"  Frontend: {FRONTEND_DIR}")
    print(f"  API:      http://localhost:{PORT}/api/health")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.")
        server.server_close()


if __name__ == "__main__":
    main()
