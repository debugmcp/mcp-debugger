@echo off
REM -----------------------------------------------------------------------------
REM Run full test suite inside the Ubuntu CI container
REM Approach: bind-mount the repository read-only, then copy it to /tmp inside
REM           the container to avoid NTFS permission issues (EACCES) on node_modules.
REM
REM Prerequisite (one-time):
REM     docker build -f test-ubuntu.dockerfile -t mcp-debugger-ci .
REM
REM Usage:
REM     scripts\run-ubuntu-tests.cmd
REM -----------------------------------------------------------------------------

docker run --rm -it ^
  -v "%cd%":/workspace:ro ^
  -w /workspace ^
  mcp-debugger-ci ^
  bash -lc "set -euo pipefail && cp -r /workspace /tmp/project && cd /tmp/project && npm ci && npm run test"
