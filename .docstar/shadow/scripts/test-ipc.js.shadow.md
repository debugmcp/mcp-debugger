# scripts/test-ipc.js
@source-hash: 0aacfd28ee6ca516
@generated: 2026-02-10T00:41:58Z

## Purpose
Test script that verifies Inter-Process Communication (IPC) functionality between a parent process and a spawned child process running the proxy bootstrap.

## Key Components

**Main Process Flow (L8-62):**
- Spawns a child process running `proxy-bootstrap.js` with IPC enabled (L11-16)
- Configures stdio with IPC channel: `['pipe', 'pipe', 'pipe', 'ipc']` (L14)
- Sets working directory to parent of script location (L15)

**IPC Test Message (L26-34):**
- Sends initialization command with test parameters after 1-second delay (L24-39)
- Message structure includes: `cmd`, `sessionId`, `executablePath`, `adapterHost`, `adapterPort`, `logDir`, `scriptPath`

**Event Handlers:**
- `spawn` event: Logs child PID and IPC channel status, sends test message (L18-40)
- `message` event: Receives and logs messages from child process (L42-44)
- `stderr`/`stdout` events: Captures and logs child process output (L46-52)
- `exit` event: Logs child process exit code (L54-56)

**Cleanup (L58-62):**
- Auto-kills child process after 10 seconds to prevent hanging

## Dependencies
- `child_process.spawn` for process spawning
- `path` and `url` modules for file path resolution
- Expects `dist/proxy/proxy-bootstrap.js` to exist in parent directory

## Architecture Notes
- Uses ES modules (`import.meta.url`) for path resolution (L6)
- Implements timeout-based testing pattern with diagnostic logging
- Designed for development/debugging of IPC communication channels