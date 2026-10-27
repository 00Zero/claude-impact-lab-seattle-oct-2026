#!/usr/bin/env bash
# One-command local demo: checks Python + Ollama, pulls the pinned model if needed,
# starts the server on loopback, and opens the browser. macOS/Linux.
set -euo pipefail
cd "$(dirname "$0")"

MODEL="${COACH_MODEL:-gemma4:e4b}"
OLLAMA_URL="${OLLAMA_URL:-http://127.0.0.1:11434}"
PORT="${COACH_PORT:-8765}"
export COACH_MODEL="$MODEL" OLLAMA_URL COACH_PORT="$PORT"

say() { printf '\033[1;32m==>\033[0m %s\n' "$*"; }
die() { printf '\033[1;31mError:\033[0m %s\n' "$*" >&2; exit 1; }

command -v python3 >/dev/null || die "Python 3.9+ is required (macOS: xcode-select --install)."
python3 -c 'import sys; sys.exit(sys.version_info < (3, 9))' || die "Python 3.9+ is required."

version=$(curl -fsS "$OLLAMA_URL/api/version" 2>/dev/null) ||
  die "Ollama is not running at $OLLAMA_URL. Install it from https://ollama.com/download, open it, and rerun."
say "Ollama $version at $OLLAMA_URL"

if ! curl -fsS "$OLLAMA_URL/api/tags" | grep -q "\"$MODEL\""; then
  say "Downloading $MODEL (one time, ~6.6 GB)…"
  if command -v ollama >/dev/null; then
    OLLAMA_HOST="${OLLAMA_URL#http://}" ollama pull "$MODEL" ||
      die "Pull failed. If it says a newer version is required, update Ollama from https://ollama.com/download."
  else
    out=$(curl -sS "$OLLAMA_URL/api/pull" -d "{\"model\":\"$MODEL\",\"stream\":false}")
    echo "$out" | grep -q '"success"' ||
      die "Pull failed: $out  (If it mentions a newer version, update Ollama from https://ollama.com/download.)"
  fi
fi
say "Model $MODEL ready"

url="http://127.0.0.1:$PORT"
( until curl -fsS "$url/api/state" >/dev/null 2>&1; do sleep 0.5; done
  say "Demo running at $url  (Ctrl+C to stop)"
  if command -v open >/dev/null; then open "$url"; elif command -v xdg-open >/dev/null; then xdg-open "$url"; fi ) &
exec python3 app/server.py
