# src/proxy/signal-debug.ts
@source-hash: 9b855da7c44d10b8
@generated: 2026-02-09T18:15:05Z

## Primary Purpose
Signal debugging utility that provides comprehensive logging and diagnostics when the Node.js process receives termination signals, particularly SIGTERM. Designed for troubleshooting unexpected process termination in proxy/session management scenarios.

## Key Functions

### setupSignalDebugging(sessionId: string) (L8-88)
Main function that installs signal handlers and diagnostic logging. Takes a session identifier for log correlation.

**Initial Setup (L9-20):**
- Logs process identifiers (PID, parent PID)
- Captures initial process tree using `ps auxf` command
- Saves process tree to `/tmp/process-tree-${sessionId}-start.log`

**SIGTERM Handler (L23-77):**
- Comprehensive logging on SIGTERM receipt
- Reads `/proc/self/status` for process metadata (PPid, TracerPid, SigQ)
- Captures process tree at termination time
- Filters and displays Node.js/proxy related processes
- Checks `dmesg` for OOM killer activity
- Graceful exit with 500ms delay and standard SIGTERM exit code (143)

**Additional Signal Monitoring (L80-85):**
- Tracks SIGHUP, SIGINT, SIGQUIT, SIGUSR1, SIGUSR2
- Simple logging without termination logic

## Dependencies
- **fs**: File system operations for log writing and /proc reading
- **child_process.execSync**: Shell command execution for `ps` and `dmesg`

## Architecture Notes
- Uses synchronous operations during signal handling for reliability
- Defensive error handling with try-catch blocks around system calls
- Temporary file logging with session-based naming for correlation
- Dual logging strategy: files for persistence, stderr for immediate visibility

## Critical Constraints
- Linux-specific implementation (relies on /proc filesystem and Unix commands)
- Signal handlers installed globally - single setup per process
- File writes to /tmp directory require write permissions
- 500ms termination delay may impact shutdown timing requirements