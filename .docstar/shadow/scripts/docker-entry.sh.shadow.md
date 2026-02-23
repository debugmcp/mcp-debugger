# scripts\docker-entry.sh
@source-hash: db6dda6e243df016
@generated: 2026-02-23T15:25:56Z

**Primary Purpose:** Docker container entrypoint script that initializes the mcp-debugger application with proper logging and environment setup.

**Key Components:**
- **Startup logging block (L4-8):** Captures entry context (timestamp, arguments) to `/app/logs/entry.log` with stderr redirection
- **Environment setup (L9):** Sets `MCP_WORKSPACE_ROOT` with fallback default to `/workspace` 
- **Application launch (L10):** Executes Node.js with bundled application, passing through all command-line arguments

**Architecture Pattern:** Standard Docker entrypoint pattern with early logging for debugging container startup issues. Uses `exec` to replace shell process with Node.js, ensuring proper signal handling.

**Dependencies:**
- `/app/logs/` directory must exist for logging
- `/app/scripts/stdio-silencer.cjs` module for stdio management
- `dist/bundle.cjs` as the main application bundle
- Node.js runtime in container PATH

**Critical Details:**
- All startup output is appended to persistent log file
- `--no-warnings` flag suppresses Node.js warnings
- `"$@"` preserves argument quoting and spacing
- Script uses POSIX shell (`#!/bin/sh`) for maximum compatibility