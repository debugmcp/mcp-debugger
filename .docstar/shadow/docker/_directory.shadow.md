# docker/
@generated: 2026-02-09T18:16:02Z

## Docker Containerization Module

This directory provides Docker containerization infrastructure for an MCP (Model Context Protocol) server with integrated debugging capabilities.

### Overall Purpose
Enables containerized deployment of MCP servers with developer-friendly debugging support. The module orchestrates multi-process container environments that combine production MCP server functionality with remote debugging capabilities for development workflows.

### Key Components

**docker-entrypoint.sh**
- Primary container entry point script
- Manages dual-process architecture (MCP server + debug adapter)
- Handles workspace mounting and graceful shutdown
- Implements signal-based lifecycle management

### Public API Surface

**Container Entry Point**
- `/docker-entrypoint.sh` - Main container startup script
- Accepts standard Docker environment variables and volume mounts
- Supports optional `/workspace` directory mounting for development

**Debug Interface**
- Remote debugging server exposed on port 5679
- Python debugpy protocol for IDE integration
- Automatically spawned alongside main application

### Internal Organization

**Process Architecture**
```
Container Startup
├── Workspace detection and mounting
├── Background: Python debugpy server (port 5679)
├── Foreground: Node.js MCP server (dist/index.js)
└── Signal handling for graceful shutdown
```

**Data Flow**
1. Container initialization and workspace setup
2. Debug server spawn with process tracking
3. MCP server launch as primary process
4. Signal-based coordination for clean termination

### Important Patterns

**Multi-Process Coordination**
- Background debug server with PID tracking
- Foreground application server
- Trap-based signal handling for cleanup

**Development Integration**
- Conditional workspace mounting (`/workspace`)
- Remote debugging without application blocking
- Debug-level logging enabled by default

**Container Best Practices**
- Graceful shutdown handling
- Process cleanup on termination
- Flexible directory structure support

This module serves as the containerization layer for MCP servers, providing both production deployment capabilities and development debugging features in a unified Docker environment.