# src/proxy/proxy-bootstrap.js
@source-hash: fb950fbbc5b243bb
@generated: 2026-02-09T18:15:06Z

## Purpose
Bootstrap script for DAP (Debug Adapter Protocol) proxy process initialization. Runs before TypeScript types are available, handles process lifecycle, orphan detection, and dynamically loads the appropriate proxy implementation.

## Key Functions

**logBootstrapActivity (L16-18)**: Logs bootstrap activities to stderr with timestamped prefix for debugging proxy startup.

**Signal Handlers (L21-35)**: 
- SIGTERM/SIGINT handlers (L21-29) for graceful shutdown
- disconnect handler (L32-35) for parent process death detection

**Orphan Detection Loop (L42-59)**: 10-second interval checking for orphaned processes using container-aware detection and heartbeat timeout (30s). Sends heartbeat pings to parent and terminates if communication fails.

**Message Handler (L62-64)**: Updates lastHeartbeat timestamp on any parent IPC message.

## Core Bootstrap Logic (L68-115)

**Environment Setup (L71-72)**: Sets `DAP_PROXY_WORKER=true` to signal proxy mode.

**Proxy Selection (L75-91)**: 
- Prefers bundled version (`proxy-bundle.cjs`) over unbundled (`dap-proxy-entry.js`)
- Validates file existence and exits on failure

**Dynamic Import (L93-109)**:
- Converts file paths to proper file:// URLs for cross-platform ESM compatibility
- Windows paths get three slashes (`file:///C:/...`), Unix paths get two (`file://...`)
- Handles import errors with detailed logging

## Dependencies
- `fs`, `path`, `url` (Node.js built-ins)
- `./utils/orphan-check.js` for container-safe orphan detection

## Key Variables
- `HEARTBEAT_TIMEOUT`: 30-second communication timeout (L39)
- `lastHeartbeat`: Tracks parent communication (L38)
- `bootstrapLogPrefix`: Timestamped log prefix (L13)

## Architectural Notes
- Uses stderr for all logging (intentional for debugging)
- ESLint disabled for console usage (L1)
- Robust process lifecycle management with multiple termination triggers
- Container-aware orphan detection to handle Docker/container environments
- Cross-platform file URL handling for dynamic imports