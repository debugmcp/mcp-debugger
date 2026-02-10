# scripts/collect-stdio-logs.ps1
@source-hash: bbd84a81d61aee27
@generated: 2026-02-09T18:15:10Z

## Purpose
PowerShell diagnostic script for collecting stdout/stderr logs from the mcp-debugger Docker container. Used for troubleshooting and analyzing CLI command execution.

## Core Functionality

**Setup Phase (L1-8)**
- No parameters required
- Creates logs/diag-stdio directory in project root
- Sets strict error handling with $ErrorActionPreference = 'Stop'

**Docker Execution (L10-14)**
- Mounts host logs/diag-stdio to container /app/logs via volume binding
- Executes containerized commands in mcp-debugger:local image:
  - Clears existing logs with `rm -f /app/logs/*`
  - Captures CLI help output to cli-help.txt
  - Runs stdio command in background, kills after 3 seconds
  - All stdout/stderr redirected to respective log files

**Log Display Phase (L16-33)**
- Shows host directory contents
- Displays four key log files with conditional existence checks:
  - cli-help.txt: Full CLI help output
  - cli-stdio.txt: First 200 lines of stdio command output
  - bundle-start.log: Complete bundle startup logs
  - debug-mcp-server.log: Last 200 lines of server debug logs

## Key Dependencies
- Docker with mcp-debugger:local image
- PowerShell cmdlets: Get-Location, Join-Path, New-Item, Test-Path, Get-Content
- Container must have Node.js with dist/index.js available

## Architecture Notes
- Uses volume mounting strategy for log extraction from ephemeral containers
- Implements graceful failure handling with `|| true` patterns
- Background process management with PID tracking and cleanup
- Truncated output display prevents overwhelming console output