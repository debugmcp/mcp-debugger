# docker-compose.test.yml
@source-hash: 57b5c63fd94c9479
@generated: 2026-02-24T01:54:05Z

Docker Compose configuration for testing the MCP (Model Context Protocol) debugger service in development mode.

## Service Configuration
- **mcp-debugger service** (L3-13): Main test container configuration
  - Uses local build context (L5) instead of pre-built image
  - Resource constraints: 512MB memory limit (L6), 0.5 CPU cores (L7)
  - Interactive mode enabled with stdin/tty (L8-9) for debugging sessions

## Volume Mounts
- **Workspace binding** (L11): Maps current directory to `/workspace` for live code editing
- **Log persistence** (L12): Maps local `./logs` to container `/tmp` for log file access

## Runtime Configuration
- **Command override** (L13): Runs MCP debugger in stdio mode with debug logging to `/tmp/mcp-debugger.log`
- Uses Docker Compose v3.8 specification (L1) for modern feature support

## Development Workflow
Designed for interactive debugging sessions where developers can:
- Edit code locally and see changes reflected in container
- Access detailed debug logs through mounted volume
- Interact with the MCP debugger through stdio interface