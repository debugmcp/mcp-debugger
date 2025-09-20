# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

mcp-debugger is a Model Context Protocol (MCP) server that provides step-through debugging capabilities for AI agents. It acts as a bridge between MCP clients (like Claude) and debug adapters, enabling structured debugging operations through JSON-based tool calls.

The project uses a **monorepo architecture** with dynamic adapter loading, allowing language-specific debug adapters to be developed and deployed independently.

## Monorepo Structure

```
mcp-debugger/
├── packages/
│   ├── shared/          # Shared interfaces, types, and utilities
│   ├── adapter-python/  # Python debug adapter using debugpy
│   └── adapter-mock/    # Mock adapter for testing
├── src/
│   ├── adapters/       # Adapter loading and registry system
│   ├── container/      # Dependency injection container
│   ├── proxy/          # DAP proxy system
│   └── session/        # Session management
└── tests/              # Comprehensive test suite
```

### Package Details

- **@debugmcp/shared**: Core interfaces and types used across all packages
- **@debugmcp/adapter-python**: Python debugging support via debugpy
- **@debugmcp/adapter-mock**: Mock adapter for testing and development

## Key Commands

### Building and Development

```bash
# Install dependencies (including workspace packages)
npm install

# Build all packages and main project
npm run build

# Build specific packages
npm run build:shared
npm run build:adapters
npm run build:packages  # Build all packages via TypeScript project references

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

## Path Handling Policy 🚨 CRITICAL

**The project uses a TRUE HANDS-OFF approach to path handling:**

1. **Accept all paths as-is** - No interpretation of Windows vs Linux paths
2. **File existence check only** - For immediate LLM UX feedback (`SimpleFileChecker`)
3. **Container mode: Simple prefix** - Only `/workspace/` prepend for existence checks  
4. **Pass original paths unchanged** - To debug adapter (debugpy handles path resolution)
5. **No cross-platform logic** - Avoids unsolvable edge cases and complexity

**Key Files:**
- `src/utils/simple-file-checker.ts` - Only path-related logic (existence checking)
- `src/server.ts` - Uses SimpleFileChecker for validation, passes original paths to SessionManager

**Rationale:** Cross-platform path handling is theoretically impossible due to ambiguous edge cases. The debug adapter and OS know best how to handle paths for their environment.

## Architecture Overview

The codebase follows a **layered architecture with dependency injection** and **dynamic adapter loading**:

### Core Components

1. **MCP Server Layer** (`src/server.ts`, `src/index.ts`)
   - Entry point for MCP protocol communication
   - Handles tool registration and routing
   - Supports STDIO, TCP, and SSE transport modes
   - Dynamically discovers available language adapters

2. **Adapter System** (NEW)
   - **AdapterRegistry** (`src/adapters/adapter-registry.ts`): Manages adapter lifecycle
   - **AdapterLoader** (`src/adapters/adapter-loader.ts`): Dynamically loads adapters on-demand
   - **Language Adapters** (`packages/adapter-*`): Language-specific implementations
   - Supports both pre-registered and dynamically loaded adapters

3. **SessionManager** (`src/session/session-manager.ts`)
   - Central orchestrator for debug sessions
   - Manages session lifecycle and state
   - Coordinates ProxyManager instances (one per session)
   - Handles breakpoint management and queuing

4. **ProxyManager** (`src/proxy/proxy-manager.ts`)
   - Manages communication with debug proxy process
   - Spawns proxy worker in separate process
   - Implements typed event system for DAP events
   - Handles request/response correlation with timeouts

5. **DAP Proxy System** (`src/proxy/dap-proxy-*.ts`)
   - **ProxyCore**: Pure business logic, message processing
   - **ProxyWorker**: Core worker handling debugging operations
   - **AdapterManager**: Manages language-specific adapter instances
   - Implements full Debug Adapter Protocol (DAP) communication

### Key Patterns

- **Dependency Injection**: All major components use constructor injection via interfaces
- **Factory Pattern**: `ProxyManagerFactory`, `SessionStoreFactory`, `AdapterFactory` for testability
- **Dynamic Loading**: Language adapters loaded on-demand via ES modules
- **Event-Driven**: Extensive EventEmitter usage for async communication
- **Process Isolation**: Each debug session runs in separate process for stability
- **Error Boundaries**: Centralized error handling with user-friendly messages

### Data Flow

```
MCP Client → MCP Server → SessionManager → ProxyManager → ProxyWorker → Language Adapter → Debug Runtime
                ↓
         AdapterRegistry → AdapterLoader → Dynamic Import of @debugmcp/adapter-*
```

### Dynamic Adapter Loading

The system supports dynamic adapter loading through:

1. **AdapterLoader**: Attempts to load adapters by package name (`@debugmcp/adapter-{language}`)
2. **Fallback Paths**: Checks multiple locations (node_modules, packages directory)
3. **Registry Integration**: Auto-registers dynamically loaded adapters
4. **Container Mode**: Pre-loads known adapters in Docker environments

### State Management

Sessions progress through states: IDLE → INITIALIZING → READY → RUNNING → PAUSED → TERMINATED

## Important Files and Directories

### Core System
- `src/server.ts` - Main MCP server implementation
- `src/session/session-manager.ts` - Core session orchestration
- `src/proxy/proxy-manager.ts` - Proxy process management
- `src/proxy/dap-proxy-worker.ts` - Debug adapter protocol implementation

### Adapter System
- `src/adapters/adapter-registry.ts` - Adapter lifecycle management
- `src/adapters/adapter-loader.ts` - Dynamic adapter loading
- `packages/shared/` - Shared interfaces and types
- `packages/adapter-python/` - Python debug adapter
- `packages/adapter-mock/` - Mock adapter for testing

### Supporting Infrastructure
- `src/container/dependencies.ts` - Dependency injection container
- `src/utils/error-messages.ts` - Centralized error messages
- `tests/` - Comprehensive test suite (unit, integration, e2e)
- `examples/` - Example scripts for debugging
- `docs/architecture/` - Detailed architecture documentation

## Development Guidelines

1. **TypeScript Strict Mode**: All code must pass TypeScript strict mode checks
2. **Monorepo Management**: Use npm workspaces for package management
3. **Test Coverage**: Maintain >90% test coverage
4. **Error Handling**: Use centralized error messages from `error-messages.ts`
5. **Logging**: Use Winston logger with appropriate log levels
6. **Async Operations**: All DAP operations are async with timeouts
7. **Process Cleanup**: Always ensure proper cleanup of spawned processes
8. **Adapter Development**: New language adapters should implement `IAdapterFactory` from `@debugmcp/shared`

## Testing Approach

The project uses Vitest with three test levels:
- **Unit Tests**: Test components in isolation with mocks
- **Integration Tests**: Test component interactions
- **E2E Tests**: Test full debugging workflows with real debugpy

## Common Debugging Scenarios

When debugging issues:
1. Enable debug logging: `DEBUG=* node dist/index.js`
2. Check proxy process output in logs
3. Verify language-specific requirements (e.g., `python -m debugpy --version`)
4. Use `--dry-run` flag to test configuration without starting debug session

## Adding New Language Adapters

To add support for a new language:

1. **Create Package**: Add new package under `packages/adapter-{language}/`
2. **Implement Interfaces**: Implement `IAdapterFactory` and `IDebugAdapter` from `@debugmcp/shared`
3. **Export Factory**: Export a factory class named `{Language}AdapterFactory`
4. **Update Registry**: The adapter will be dynamically loaded when requested
5. **Add Tests**: Include unit and integration tests in the package

Example structure:
```
packages/adapter-nodejs/
├── src/
│   ├── index.ts         # Export NodejsAdapterFactory
│   ├── adapter.ts       # Implement IDebugAdapter
│   └── factory.ts       # Implement IAdapterFactory
├── tests/
├── package.json
└── tsconfig.json
```

## Language-Specific Requirements

### Python
- Python 3.7+ must be installed
- debugpy must be installed: `pip install debugpy`
- The system will auto-detect Python path or use `PYTHON_PATH` env var

### Mock (Testing)
- No external requirements
- Used for testing the debug infrastructure