# src/proxy/proxy-bootstrap.js
@source-hash: fb950fbbc5b243bb
@generated: 2026-02-10T00:41:52Z

## Primary Purpose

Bootstrap script for proxy processes that initializes process lifecycle management and dynamically loads the appropriate proxy implementation. Runs before TypeScript types are available and sets up robust orphan detection, signal handling, and heartbeat monitoring.

## Key Functions

- `logBootstrapActivity(message)` (L16-18): Simple logging utility that outputs to stderr with timestamp prefix for debugging proxy startup
- Anonymous async IIFE (L68-115): Main bootstrap logic that determines and loads proxy implementation

## Process Lifecycle Management

**Signal Handlers** (L21-35):
- SIGTERM/SIGINT handlers for graceful shutdown
- `disconnect` event handler for parent process death detection

**Orphan Detection** (L37-59):
- Uses `shouldExitAsOrphanFromEnv()` utility for container-safe orphan detection
- Heartbeat mechanism with 30-second timeout to detect communication loss
- 10-second interval check for orphaned state
- Attempts parent ping via IPC before terminating

**Heartbeat Management** (L62-64):
- Updates `lastHeartbeat` timestamp on any parent message
- Enables detection of stale parent processes

## Proxy Loading Strategy

**Path Resolution** (L75-82):
- Prefers bundled version (`proxy-bundle.cjs`) over unbundled (`dap-proxy-entry.js`)
- Uses simple file existence check to determine which version to load

**Dynamic Import** (L93-109):
- Converts file paths to proper file URLs for ESM import compatibility
- Handles Windows/Unix path normalization differences
- Comprehensive error handling with stack traces

## Dependencies

- `fs`, `path`: Standard Node.js modules for file operations
- `url.fileURLToPath`: ES module path conversion
- `./utils/orphan-check.js`: Container-aware orphan detection utility

## Environment Setup

- Sets `DAP_PROXY_WORKER=true` environment variable (L71) to signal proxy mode
- Maintains current working directory context

## Critical Constraints

- Must run before TypeScript compilation
- Requires either `proxy-bundle.cjs` or `dap-proxy-entry.js` to exist
- Depends on IPC communication with parent process
- Uses stderr exclusively for logging (stdout reserved for proxy communication)