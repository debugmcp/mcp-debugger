#!/usr/bin/env bash
# Inject an mcp-debugger ephemeral debug container into a pod and
# port-forward its MCP endpoint to 127.0.0.1:3001.
#
# Usage: ./debug-sidecar.sh <label-selector> [namespace]
#   e.g. ./debug-sidecar.sh app=cpp-demo
#
# Notes:
# - Ephemeral containers cannot be removed or restarted; each run uses a
#   fresh container name. A pod restart clears them all.
# - Git Bash on Windows mangles the /app/entry.sh argument — run as:
#   MSYS_NO_PATHCONV=1 ./debug-sidecar.sh app=cpp-demo
# - The MCP HTTP port is unauthenticated: keep it behind kubectl
#   port-forward, never expose it via a Service.
set -euo pipefail

SELECTOR="${1:?usage: debug-sidecar.sh <label-selector> [namespace]}"
NS="${2:-default}"
NAME="debugger-$(date +%s)"

POD=$(kubectl -n "$NS" get pods -l "$SELECTOR" -o jsonpath='{.items[0].metadata.name}')
echo "Injecting ephemeral container '$NAME' into pod/$POD (target container: app)..."
kubectl -n "$NS" debug "$POD" --image=debugmcp/mcp-debugger:latest \
  --target=app --profile=general --container="$NAME" \
  --env=MCP_HTTP_STALE_SESSION_MS=300000 \
  -- /app/entry.sh http -p 3001

echo "Register with your agent:  claude mcp add-json k8s-sidecar '{\"type\":\"http\",\"url\":\"http://127.0.0.1:3001/mcp\"}'"
echo "Port-forwarding 127.0.0.1:3001 -> pod/$POD:3001 (Ctrl-C to stop)..."
kubectl -n "$NS" port-forward "pod/$POD" 3001:3001
