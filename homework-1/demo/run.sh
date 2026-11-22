#!/usr/bin/env bash
# Starts the Banking Transactions API, waits until GET /health answers, then loads
# demo/sample-data.json (Phase 6, UF-2, UF-7). The server keeps running in the
# foreground; press Ctrl+C to stop it.
#
# Usage: demo/run.sh [--no-seed]
#   --no-seed   start with an empty store (the sample transfer then fails: no funds)
# Environment: PORT (default 3000)
set -euo pipefail

usage() {
  sed -n '6,8p' "$0" | sed 's/^# \{0,1\}//'
}

seed=1
for arg in "$@"; do
  case "$arg" in
    --no-seed) seed=0 ;;
    -h | --help) usage; exit 0 ;;
    *) echo "Unknown option: $arg" >&2; usage >&2; exit 2 ;;
  esac
done

cd "$(dirname "$0")/.."

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 22 or newer is required: https://nodejs.org" >&2
  exit 1
fi
node_major=$(node -p 'process.versions.node.split(".")[0]')
if [ "$node_major" -lt 22 ]; then
  echo "Node.js 22 or newer is required (found $(node -v))." >&2
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "Installing dependencies (npm ci)..."
  npm ci
fi

export PORT="${PORT:-3000}"
base_url="http://localhost:${PORT}"

health_ok() {
  node -e 'fetch(process.argv[1]).then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))' \
    "${base_url}/health"
}

# Another instance answering on this port would get seeded instead of ours.
if health_ok; then
  echo "Port ${PORT} is already in use (something answers ${base_url}/health). Stop it or set PORT." >&2
  exit 1
fi

node src/server.js &
server_pid=$!
trap 'kill "$server_pid" 2>/dev/null || true' EXIT
trap 'exit 130' INT TERM

healthy=0
for _ in $(seq 1 50); do
  if ! kill -0 "$server_pid" 2>/dev/null; then
    echo "The server exited before it became healthy (is port ${PORT} already in use?)." >&2
    exit 1
  fi
  if health_ok; then
    healthy=1
    break
  fi
  sleep 0.2
done
if [ "$healthy" -ne 1 ]; then
  echo "GET ${base_url}/health did not answer within 10 seconds." >&2
  exit 1
fi

if [ "$seed" -eq 1 ]; then
  node demo/seed.js "$base_url"
else
  echo "Skipping sample data (--no-seed)."
fi

echo "API is running at ${base_url}. Try demo/sample-requests.http. Press Ctrl+C to stop."
wait "$server_pid"
