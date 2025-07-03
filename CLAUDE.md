# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

mcp-debugger is a Model Context Protocol (MCP) server that provides step-through debugging capabilities for AI agents. It acts as a bridge between MCP clients (like Claude) and debug adapters (currently debugpy for Python), enabling structured debugging operations through JSON-based tool calls.

## Key Commands

### Building and Development

```bash
# Install dependencies
npm install

# Build the project (required before running)
npm run build

# Clean build
npm run build:clean

# Development mode with watch
npm run dev

# Start the server (after building)
npm start
# or
node dist/index.js

# Run with specific transport modes
node dist/index.js                          # STDIO mode (default)
node dist/index.js --transport tcp --port 6111  # TCP mode
node dist/index.js --transport sse --port 3000  # SSE mode
```

### Testing

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit         # Unit tests only
npm run test:integration  # Integration tests only
npm run test:e2e         # End-to-end tests only

# Run tests with coverage
npm run test:coverage
npm run test:coverage:summary  # Show coverage summary

# Run tests in watch mode
npm run test:watch

# Run a specific test file
npx vitest run tests/unit/session/session-manager.test.ts

# Run smoke tests for quick validation
npm run test:e2e:smoke
```

### Code Quality

```bash
# Lint code
npm run lint

# Fix linting issues automatically
npm run lint:fix

# Check for personal paths (pre-commit hook)
npm run check:personal-paths
npm run check:all-personal-paths  # Check all files
```

### Docker

```bash
# Build Docker image
npm run docker-build
# or
docker build -t mcp-debugger:local .

# Test container locally
npm run test:e2e:container

# Run container
docker run -v $(pwd):/workspace mcp-debugger:local
```

### GitHub Actions Testing (Act)

```bash
# Test GitHub Actions locally using Act
npm run act:check    # Verify Act is installed
npm run act:lint     # Run lint job
npm run act:test     # Run test job (Ubuntu)
npm run act:test:all # Run all test jobs
npm run act:full     # Run full CI workflow
```

## Architecture Overview

The codebase follows a layered architecture with dependency injection:

### Core Components

1. **MCP Server Layer** (`src/server.ts`, `src/index.ts`)
   - Entry point for MCP protocol communication
   - Handles tool registration and routing
   - Supports STDIO, TCP, and SSE transport modes

2. **SessionManager** (`src/session/session-manager.ts`)
   - Central orchestrator for debug sessions
   - Manages session lifecycle and state
   - Coordinates ProxyManager instances (one per session)
   - Handles breakpoint management and queuing

3. **ProxyManager** (`src/proxy/proxy-manager.ts`)
   - Manages communication with debug proxy process
   - Spawns proxy worker in separate process
   - Implements typed event system for DAP events
   - Handles request/response correlation with timeouts

4. **DAP Proxy System** (`src/proxy/dap-proxy-*.ts`)
   - **ProxyCore**: Pure business logic, message processing
   - **ProxyWorker**: Core worker handling debugging operations
   - **ProcessManager**: Manages debugpy adapter lifecycle
   - Implements full Debug Adapter Protocol (DAP) communication

### Key Patterns

- **Dependency Injection**: All major components use constructor injection via interfaces
- **Factory Pattern**: `ProxyManagerFactory`, `SessionStoreFactory` for testability
- **Event-Driven**: Extensive EventEmitter usage for async communication
- **Process Isolation**: Each debug session runs in separate process for stability
- **Error Boundaries**: Centralized error handling with user-friendly messages

### Data Flow

```
MCP Client → MCP Server → SessionManager → ProxyManager → ProxyWorker → debugpy → Python Script
```

### State Management

Sessions progress through states: IDLE → INITIALIZING → READY → RUNNING → PAUSED → TERMINATED

## Important Files and Directories

- `src/server.ts` - Main MCP server implementation
- `src/session/session-manager.ts` - Core session orchestration
- `src/proxy/proxy-manager.ts` - Proxy process management
- `src/proxy/dap-proxy-worker.ts` - Debug adapter protocol implementation
- `src/utils/error-messages.ts` - Centralized error messages
- `tests/` - Comprehensive test suite (unit, integration, e2e)
- `examples/` - Example Python scripts for debugging
- `docs/architecture/` - Detailed architecture documentation

## Development Guidelines

1. **TypeScript Strict Mode**: All code must pass TypeScript strict mode checks
2. **Test Coverage**: Maintain >90% test coverage
3. **Error Handling**: Use centralized error messages from `error-messages.ts`
4. **Logging**: Use Winston logger with appropriate log levels
5. **Async Operations**: All DAP operations are async with timeouts
6. **Process Cleanup**: Always ensure proper cleanup of spawned processes

## Testing Approach

The project uses Vitest with three test levels:
- **Unit Tests**: Test components in isolation with mocks
- **Integration Tests**: Test component interactions
- **E2E Tests**: Test full debugging workflows with real debugpy

## Common Debugging Scenarios

When debugging issues:
1. Enable debug logging: `DEBUG=* node dist/index.js`
2. Check proxy process output in logs
3. Verify debugpy is installed: `python -m debugpy --version`
4. Use `--dry-run` flag to test configuration without starting debug session

## Python Requirements

- Python 3.7+ must be installed
- debugpy must be installed: `pip install debugpy`
- The system will auto-detect Python path or use `PYTHON_PATH` env var