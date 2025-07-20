# debug-mcp-server-launcher

A Python launcher for the debug-mcp-server, providing step-through debugging capabilities for LLM agents.

## Overview

This launcher simplifies running the debug-mcp-server by:
- Auto-detecting available runtimes (Node.js/npm or Docker)
- Automatically launching the server with the appropriate runtime
- Handling process lifecycle and graceful shutdowns
- Providing clear error messages and installation guidance

## Installation

```bash
pip install debug-mcp-server-launcher
```

This will install the launcher and ensure `debugpy` (required for Python debugging) is available.

## Usage

### Basic Usage

```bash
# Launch in stdio mode (default)
debug-mcp-server

# Launch in SSE mode
debug-mcp-server sse

# SSE mode with custom port
debug-mcp-server sse --port 8080
```

### Runtime Selection

The launcher automatically detects and uses the best available runtime:
1. **npm/npx** (preferred) - if Node.js is installed
2. **Docker** (fallback) - if Docker is installed and running

You can force a specific runtime:

```bash
# Force Docker mode
debug-mcp-server --docker

# Force npm mode  
debug-mcp-server --npm
```

### Other Options

```bash
# Show what command would be executed
debug-mcp-server --dry-run

# Enable verbose output
debug-mcp-server --verbose

# Show version
debug-mcp-server --version

# Show help
debug-mcp-server --help
```

## Requirements

### For npm/npx mode:
- Node.js 16+ installed
- The launcher will automatically download the server package via npx

### For Docker mode:
- Docker installed and running
- The launcher will automatically pull the image if needed

### For Python debugging:
- `debugpy` is automatically installed with this package

## Transport Modes

- **stdio**: Standard input/output communication (default)
- **sse**: Server-Sent Events mode for HTTP-based communication
  - Default port: 3001
  - Custom port: Use `--port` option

## Troubleshooting

If you encounter issues:

1. **"No suitable runtime found"**
   - Install Node.js from https://nodejs.org (recommended)
   - Or install Docker from https://docker.com

2. **"Docker daemon is not running"**
   - Start Docker Desktop
   - Or use npm mode: `debug-mcp-server --npm`

3. **"npx command not found"**
   - Ensure Node.js is properly installed
   - npx typically comes with npm (Node.js package manager)

## Development

This is a launcher package for the main debug-mcp-server project. For server development and contributions, see:
https://github.com/debugmcp/mcp-debugger

## License

MIT
