# scripts/start-sse-server.sh
@source-hash: aed993bdb14eba13
@generated: 2026-02-10T00:41:58Z

## Primary Purpose
Bash script that validates runtime dependencies and launches the Debug MCP Server in SSE (Server-Sent Events) mode. Acts as a wrapper that ensures proper environment setup before starting the Node.js server.

## Key Functionality

### Environment Validation (L8-35)
- **Node.js Check (L9-13)**: Verifies `node` command availability, exits with error code 1 if missing
- **Python Check (L16-27)**: Validates Python installation, supporting both `python` and `python3` commands, determines appropriate command and stores in `PYTHON_CMD` variable
- **debugpy Module Check (L30-35)**: Tests debugpy import capability using detected Python command, provides installation instructions on failure

### Server Launch (L47-48)
- **Node.js Execution**: Starts the compiled JavaScript server with specific configuration:
  - Mode: SSE (Server-Sent Events)
  - Port: 3001
  - Log level: debug
  - Log file: `logs/debug-mcp-server.log`
  - Entry point: `dist/index.js`

## Dependencies
- Node.js runtime (required for server execution)
- Python 3.x or Python 2.x interpreter
- debugpy Python module (for debugging capabilities)
- Pre-compiled JavaScript files in `dist/` directory
- Writable `logs/` directory for log output

## Architectural Patterns
- **Fail-Fast Validation**: All dependencies checked before attempting server start
- **Cross-Platform Compatibility**: Handles both `python` and `python3` command variants
- **User-Friendly Feedback**: Provides clear status messages and error instructions
- **Single Responsibility**: Focused solely on environment validation and server launching

## Runtime Configuration
- Server listens on `http://localhost:3001/sse`
- Debug-level logging enabled
- Log persistence to filesystem
- Manual termination via Ctrl+C