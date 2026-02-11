# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

mcp-debugger is a Model Context Protocol (MCP) server that provides step-through debugging capabilities for AI agents. It acts as a bridge between MCP clients (like Claude) and debug adapters, enabling structured debugging operations through JSON-based tool calls.

The project uses a **monorepo architecture** with dynamic adapter loading, allowing language-specific debug adapters to be developed and deployed independently.

## Monorepo Structure

```
mcp-debugger/
├── packages/
│   ├── shared/             # Shared interfaces, types, and utilities
│   ├── adapter-python/     # Python debug adapter using debugpy
│   ├── adapter-javascript/ # JavaScript/Node.js adapter using js-debug
│   ├── adapter-rust/       # Rust debug adapter using CodeLLDB
│   ├── adapter-go/         # Go debug adapter using Delve
│   ├── adapter-mock/       # Mock adapter for testing
│   └── mcp-debugger/       # Self-contained CLI bundle (npx distribution)
├── src/
│   ├── adapters/          # Adapter loading and registry system
│   ├── container/         # Dependency injection container
│   ├── proxy/             # DAP proxy system
│   └── session/           # Session management
└── tests/                 # Comprehensive test suite
```

### Package Details

- **@debugmcp/shared**: Core interfaces and types used across all packages
- **@debugmcp/adapter-python**: Python debugging support via debugpy
- **@debugmcp/adapter-javascript**: JavaScript/Node.js debugging support via js-debug
- **@debugmcp/adapter-rust**: Rust debugging support via CodeLLDB
- **@debugmcp/adapter-go**: Go debugging support via Delve
- **@debugmcp/adapter-mock**: Mock adapter for testing and development
- **@debugmcp/mcp-debugger**: Self-contained CLI bundle for npm distribution (npx-ready)

## Key Commands

### Building and Development

**IMPORTANT: This project uses pnpm, not npm.** The `workspace:*` protocol in dependencies requires pnpm. Run scripts via `npm run <script>` (which delegates to pnpm) or use pnpm directly.

```bash
# Install dependencies (including workspace packages)
pnpm install

# Build all packages and main project
npm run build

# Build specific packages
npm run build:shared
npm run build:adapters       # Build mock + python adapters
npm run build:adapters:all   # Build all adapters including JavaScript
npm run build:packages       # Build all packages in correct order via build-packages.cjs

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
- `src/adapters/adapter-loader.ts` - Dynamic adapter loading (5 known adapters)
- `packages/shared/` - Shared interfaces and types
- `packages/adapter-python/` - Python debug adapter (debugpy)
- `packages/adapter-javascript/` - JavaScript/Node.js debug adapter (js-debug)
- `packages/adapter-rust/` - Rust debug adapter (CodeLLDB)
- `packages/adapter-go/` - Go debug adapter (Delve)
- `packages/adapter-mock/` - Mock adapter for testing

### Distribution
- `packages/mcp-debugger/` - Self-contained CLI bundle for npm/npx distribution

### Supporting Infrastructure
- `src/container/dependencies.ts` - Dependency injection container
- `src/utils/error-messages.ts` - Centralized error messages
- `tests/` - Comprehensive test suite (unit, integration, e2e)
- `examples/` - Example scripts for debugging
- `docs/architecture/` - Detailed architecture documentation

## Development Guidelines

1. **TypeScript Strict Mode**: All code must pass TypeScript strict mode checks
2. **Monorepo Management**: Use pnpm workspaces for package management (`pnpm install`, not `npm install`)
3. **Build Order**: Packages must build in order: shared → adapters → main server. This is managed by `scripts/build-packages.cjs`
4. **Test Coverage**: Maintain >90% test coverage
5. **Error Handling**: Use centralized error messages from `error-messages.ts`
6. **Logging**: Use Winston logger with appropriate log levels
7. **Async Operations**: All DAP operations are async with timeouts
8. **Process Cleanup**: Always ensure proper cleanup of spawned processes
9. **Adapter Development**: New language adapters should implement `IAdapterFactory` from `@debugmcp/shared`

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
4. **Register in root `package.json`**: Add `"@debugmcp/adapter-{language}": "workspace:*"` to `optionalDependencies`
5. **Add Vitest alias**: Add `{ find: '@debugmcp/adapter-{language}', replacement: path.resolve(__dirname, './packages/adapter-{language}/src/index.ts') }` to `resolve.alias` in `vitest.config.ts`
6. **Update adapter count**: Update hardcoded adapter counts in tests (`adapter-loader.test.ts`, `models.test.ts`)
7. **Add Tests**: Include unit and integration tests in the package
8. **Run `pnpm install`**: To link the new workspace package

Example structure:
```
packages/adapter-{language}/
├── src/
│   ├── index.ts         # Export {Language}AdapterFactory
│   ├── {language}-debug-adapter.ts  # Implement IDebugAdapter
│   └── {language}-adapter-factory.ts  # Implement IAdapterFactory
├── tests/
├── package.json         # Must include "type": "module" and workspace:* dep on @debugmcp/shared
├── tsconfig.json
└── vitest.config.ts     # Optional if tests run from root
```

## Language-Specific Requirements

### Python
- Python 3.7+ must be installed
- debugpy must be installed: `pip install debugpy`
- The system will auto-detect Python path or use `PYTHON_PATH` env var

### JavaScript/Node.js
- Node.js 18+ must be installed
- Uses bundled js-debug adapter (VSCode's debugger)
- Supports JavaScript and TypeScript debugging
- Auto-detects TypeScript configuration

### Rust
- Rust toolchain must be installed (rustc, cargo)
- Uses vendored CodeLLDB debug adapter (auto-downloaded during `pnpm install`)
- Supports both MSVC and GNU toolchains on Windows

### Go
- Go 1.18+ must be installed
- Delve debugger must be installed: `go install github.com/go-delve/delve/cmd/dlv@latest`
- Uses Delve's native DAP protocol support

### Mock (Testing)
- No external requirements
- Used for testing the debug infrastructure

## MCP Integration with Claude Code CLI

### Installation for Claude Code

Choose the installation method that best fits your use case:

#### Option 1: NPX (No Installation Required)
```bash
# Best for: Trying out mcp-debugger
/home/ubuntu/.claude/local/claude mcp add-json mcp-debugger \
  '{"type":"stdio","command":"npx","args":["@debugmcp/mcp-debugger","stdio"]}'
```

#### Option 2: Global NPM Install
```bash
# Best for: Regular use across projects
npm install -g @debugmcp/mcp-debugger
/home/ubuntu/.claude/local/claude mcp add-json mcp-debugger \
  '{"type":"stdio","command":"mcp-debugger","args":["stdio"]}'
```

#### Option 3: Docker
```bash
# Best for: Isolation and consistency
/home/ubuntu/.claude/local/claude mcp add-json mcp-debugger \
  '{"type":"stdio","command":"docker","args":["run","-i","--rm","-v","${PWD}:/workspace","debugmcp/mcp-debugger:latest","stdio"]}'
```

#### Option 4: Build from Source
```bash
# Best for: One-off use from a local clone
pnpm install && npm run build
/home/ubuntu/.claude/local/claude mcp add-json mcp-debugger \
  '{"type":"stdio","command":"node","args":["/home/ubuntu/mcp-debugger/dist/index.js","stdio"]}'
```

**Note**: The `stdio` argument is critical - it tells the server to suppress all console output which would otherwise corrupt the JSON-RPC protocol communication.

#### Option 5: Dev Proxy (Current Setup — Recommended for Development)
```bash
# Best for: Active development of mcp-debugger itself
pnpm install && npm run build
claude mcp add-json mcp-debugger \
  '{"type":"stdio","command":"node","args":["tools/dev-proxy/dev-proxy.mjs"]}'
```

The dev proxy (`tools/dev-proxy/dev-proxy.mjs`) is a lightweight MCP proxy that sits between Claude Code and mcp-debugger. It maintains a stable stdio connection to Claude Code while managing the backend as a restartable SSE child process. This means you can rebuild and restart mcp-debugger **without restarting Claude Code** (which would lose conversation context).

**When to use**: Whenever you are actively developing mcp-debugger — making code changes, adding adapters, or installing new toolchains (Go, etc.) that need to be picked up by the running server.

**How it works**: After code changes, call the `dev_rebuild_and_restart` tool. The proxy kills the backend, runs `npm run build`, spawns a fresh process, and reconnects — all transparently. If the backend crashes, dev tools remain available to bring it back.

**Configuration** (env vars, all optional):
- `DEV_PROXY_PORT` — Backend SSE port (default: 3001)
- `DEV_PROXY_BUILD_CMD` — Build command (default: `npm run build`)
- `DEV_PROXY_ROOT` — Project root (default: auto-detected)

#### Verify Installation

After adding the MCP server:

1. **Check connection status**:
   ```bash
   /home/ubuntu/.claude/local/claude mcp list
   # Should show: mcp-debugger ... - ✓ Connected
   ```

2. **Restart Claude Code** for the changes to take effect

### Configuration Details
- **Location**: Configuration saved to `/home/ubuntu/.claude.json` under the project's `mcpServers` section
- **Server Type**: STDIO (local server)
- **Command**: `node /home/ubuntu/mcp-debugger/dist/index.js stdio` (stdio argument is required!)
- **Status Check**: After restart, type `/mcp` in Claude Code to see connected servers

### Available Tools After Integration
Once connected, the following MCP tools become available:
- `create_debug_session` - Start a new debug session
- `set_breakpoint` - Set breakpoints in code
- `start_debugging` - Begin debugging a script
- `step_over`, `step_into`, `step_out` - Step through code
- `continue_execution` - Continue running
- `get_variables`, `get_stack_trace` - Inspect program state
- `evaluate_expression` - Evaluate expressions in debug context
- `close_debug_session` - Clean up sessions

**Dev proxy only** (available when using Option 5):
- `dev_restart_debugger` - Restart the backend (pass `rebuild: true` to build first)
- `dev_rebuild_and_restart` - Run `npm run build` then restart the backend
- `dev_server_status` - Check backend state, PID, uptime, tool count

### Troubleshooting MCP Connection
- **If server shows "Failed to connect"**:
  - Ensure the `stdio` argument is included in the configuration
  - The server outputs logs to stdout by default, which corrupts JSON-RPC communication
  - Use the `add-json` command shown above to properly configure with the stdio argument
  - Note: The server includes auto-detection logic for STDIO mode (checks for pipe input and absence of transport args), but explicit `stdio` argument is most reliable
- **Test the server manually**:
  ```bash
  echo '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{"roots":{},"sampling":{}},"clientInfo":{"name":"test","version":"1.0.0"}},"id":1}' | node dist/index.js stdio
  # Should return clean JSON without any log messages
  ```
- **Verify Python and debugpy are installed**: `python3 -m debugpy --version`
- **Check logs if needed**: Set `DEBUG=debug-mcp:*` environment variable (only for troubleshooting, not for normal operation)