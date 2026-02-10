# scripts/start-sse-server.sh
@source-hash: aed993bdb14eba13
@generated: 2026-02-09T18:15:10Z

## Purpose
Bash script launcher for starting a Debug MCP (Model Context Protocol) Server in SSE (Server-Sent Events) mode with comprehensive environment validation.

## Key Components

### Environment Validation (L8-35)
- **Node.js Check (L9-12)**: Validates Node.js availability in PATH, exits with error code 1 if missing
- **Python Detection (L16-27)**: 
  - Checks for both `python` and `python3` commands
  - Prioritizes `python3` over `python` 
  - Sets `PYTHON_CMD` variable for subsequent operations
- **debugpy Validation (L30-34)**: Verifies debugpy module installation via import test

### Server Launch (L47-48)
Executes the compiled Node.js server with specific configuration:
- Mode: SSE (Server-Sent Events)
- Port: 3001
- Log level: debug
- Log file: `logs/debug-mcp-server.log`

## Dependencies
- **Node.js**: Required runtime for executing `dist/index.js`
- **Python/Python3**: Required for debugpy functionality
- **debugpy module**: Python debugging library
- **Pre-compiled server**: Expects `dist/index.js` to exist

## Architecture Pattern
Sequential validation pattern with fail-fast behavior - each dependency check must pass before proceeding to server startup. Uses command existence checks (`command -v`) rather than direct execution for safer validation.

## Configuration
- **Server endpoint**: `http://localhost:3001/sse` (L41)
- **Log destination**: `logs/debug-mcp-server.log` (L48)
- **Default log level**: debug (L48)