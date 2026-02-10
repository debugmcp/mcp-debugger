# src/proxy/signal-debug.ts
@source-hash: 9b855da7c44d10b8
@generated: 2026-02-10T00:41:53Z

## Purpose
Signal debugging utilities for tracking SIGTERM source and process termination events in proxy applications. Provides comprehensive logging and diagnostic capabilities for debugging unexpected process terminations.

## Key Components

### setupSignalDebugging (L8-88)
Main function that installs comprehensive signal handlers and diagnostic logging for a given session. Takes a `sessionId` parameter for file naming and logging correlation.

**Initial Setup (L9-20):**
- Logs process PID and parent PID information
- Captures and saves initial process tree using `ps auxf` to `/tmp/process-tree-{sessionId}-start.log`
- Provides error handling for process tree capture failures

**SIGTERM Handler (L23-77):**
- Comprehensive termination signal handler with detailed diagnostics
- Logs timestamp, PID information at termination
- Reads `/proc/self/status` for process state details (L31-41)
- Captures process tree at termination to `/tmp/process-tree-{sessionId}-sigterm.log` (L44-59)
- Filters and logs node/proxy related processes for immediate visibility
- Checks for OOM killer activity via `dmesg` output (L62-70)
- Implements delayed exit with standard SIGTERM exit code (128+15) after 500ms logging window

**Additional Signal Monitoring (L80-85):**
- Installs handlers for SIGHUP, SIGINT, SIGQUIT, SIGUSR1, SIGUSR2
- Provides basic logging for non-SIGTERM signals

## Dependencies
- `fs`: File system operations for log writing and `/proc` reading
- `child_process.execSync`: System command execution for `ps` and `dmesg`

## Architecture Patterns
- Defensive programming with extensive try-catch blocks
- Structured logging with consistent prefixes `[Signal Debug]`
- File-based persistence combined with stderr logging
- Delayed process exit to ensure diagnostic completion

## Critical Behaviors
- Process tree snapshots at startup and termination for forensic analysis
- Linux-specific `/proc/self/status` parsing for process state
- OOM killer detection through system logs
- Graceful exit with proper signal exit codes