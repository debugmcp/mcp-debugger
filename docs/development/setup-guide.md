# MCP Debug Server - Development Setup Guide

This guide will help you set up your development environment for working on the MCP Debug Server project.

## Prerequisites

### Required Software

1. **Node.js** (v22.0.0 or higher)
   - Download from [nodejs.org](https://nodejs.org/)
   - Verify installation: `node --version`

2. **pnpm** (required — the `workspace:*` protocol requires pnpm)
   - Install: `npm install -g pnpm`
   - Verify installation: `pnpm --version`

3. **Git**
   - Download from [git-scm.com](https://git-scm.com/)
   - Verify installation: `git --version`

4. **Python** (v3.7 or higher) - For testing Python debugging
   - Download from [python.org](https://www.python.org/)
   - Verify installation: `python --version`

5. **Visual Studio Code** (Recommended)
   - Download from [code.visualstudio.com](https://code.visualstudio.com/)
   - Install recommended extensions (see below)

### Optional Software

1. **Docker** - For testing Docker deployment
   - Download from [docker.com](https://www.docker.com/)
   - Verify installation: `docker --version`

2. **Go** (1.18+) and **Delve** - For Go debugging
   - Install Delve: `go install github.com/go-delve/delve/cmd/dlv@latest`

3. **Rust toolchain** - For Rust debugging
   - Install via rustup: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
   - CodeLLDB auto-downloads during `pnpm install`

4. **JDK 21+** - For Java debugging
   - Ensure `java` and `javac` are on PATH, or set `JAVA_HOME`
   - Zero external dependencies (uses JDI from the JDK)

## Initial Setup

### 1. Clone the Repository

```bash
git clone https://github.com/debugmcp/mcp-debugger.git
cd mcp-debugger
```

### 2. Install Dependencies

```bash
pnpm install
```

This will install all required dependencies across the monorepo workspace.

### 3. Install Python debugpy

The server requires `debugpy` for Python debugging:

```bash
pip install debugpy
```

Or if using pip3:

```bash
pip3 install debugpy
```

### 4. Build the Project

```bash
npm run build
```

This compiles TypeScript files to JavaScript in the `dist/` directory. For the CLI distribution package (`packages/mcp-debugger/`), a separate bundling script produces self-contained bundles (`cli.mjs` and `proxy-bundle.cjs`) using tsup.

### 5. Verify Installation

Run the test suite to ensure everything is set up correctly:

```bash
npm test
```

Most tests should pass. Some environment-specific or known-regression tests (e.g., JavaScript Docker smoke tests) may be expected to fail; see `scripts/test-docker-local.sh` for details. If unexpected failures occur, check the error messages for missing dependencies.

## Development Workflow

### Directory Structure

```
mcp-debugger/
├── packages/               # Monorepo workspace packages
│   ├── shared/            # Shared interfaces, types, and utilities
│   ├── codelldb-common/   # Shared CodeLLDB vendoring/resolution (rust + cpp)
│   ├── adapter-python/    # Python debug adapter (debugpy)
│   ├── adapter-javascript/# JavaScript/Node.js adapter (js-debug)
│   ├── adapter-rust/      # Rust adapter (CodeLLDB)
│   ├── adapter-go/        # Go adapter (Delve)
│   ├── adapter-java/      # Java debug adapter (JDI)
│   ├── adapter-dotnet/    # .NET debug adapter (netcoredbg)
│   ├── adapter-cpp/       # C/C++ debug adapter (CodeLLDB)
│   ├── adapter-ruby/      # Ruby debug adapter (rdbg)
│   ├── adapter-mock/      # Mock adapter for testing
│   ├── codelldb-darwin-arm64/  # Per-platform CodeLLDB binary packages. The
│   ├── codelldb-darwin-x64/    # payload is git-ignored and staged only at
│   ├── codelldb-linux-arm64/   # pack/publish time by
│   ├── codelldb-linux-x64/     # scripts/stage-codelldb-packages.mjs
│   ├── codelldb-win32-x64/
│   └── mcp-debugger/      # Self-contained CLI bundle (npx distribution)
├── src/                    # Core server source code
│   ├── index.ts           # Process entry point (silences console, then boots)
│   ├── server.ts          # DebugMcpServer composition root
│   ├── adapters/          # Adapter loading and registry
│   ├── cli/               # CLI commands and setup
│   ├── container/         # Dependency injection
│   ├── dap-core/          # Functional core for DAP handling (state, handlers)
│   ├── errors/            # Debug error types
│   ├── factories/         # ProxyManager and SessionStore factories
│   ├── implementations/   # Concrete file system / process / network impls
│   ├── interfaces/        # External-dependency interfaces
│   ├── proxy/             # DAP proxy components
│   ├── server/            # Tool schemas, dispatch, handlers, resources, prompts
│   ├── session/           # Session management
│   └── utils/             # Utilities
├── tests/                  # Test files
│   ├── core/             # Core unit and integration tests
│   ├── adapters/         # Adapter-specific tests
│   ├── e2e/              # End-to-end tests
│   └── test-utils/       # Shared test utilities
├── docs/                   # Documentation
├── examples/               # Example scripts
├── dist/                   # Compiled output
└── coverage/              # Test coverage reports
```

### Common Commands

```bash
# Run the server straight from TypeScript source: `ts-node-esm src/index.ts`.
# This is a one-shot run of the server, not a watch-mode build.
npm run dev

# Production build
npm run build

# Type-check the shipped sources (src + packages/*/src) — no build needed
npm run typecheck

# Type-check sources plus the test ratchet — the exact command CI and pre-push run
npm run typecheck:all

# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# View coverage summary
npm run test:coverage:summary

# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Validate the committed state in a clean clone (see ../validation-script.md)
pnpm run validate
```

### Running the Server Locally

#### STDIO Mode (Default)

```bash
node dist/index.js stdio
```

#### HTTP Mode (Streamable HTTP, recommended)

```bash
node dist/index.js http -p 3001
```

#### SSE Mode (deprecated)

SSE transport is deprecated -- use the `http` subcommand instead.

```bash
node dist/index.js sse -p 3001
```

#### With Debug Logging

```bash
node dist/index.js http -p 3001 --log-level debug --log-file ./logs/debug.log
```

Note: Console output is unconditionally silenced at process startup for all transport modes (STDIO, HTTP, and SSE) to prevent any stray output from corrupting protocol communication. Use `--log-file` to capture logs.

## VS Code Setup

### Recommended Extensions

Create `.vscode/extensions.json`:

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "vitest.explorer",
    "ms-vscode.vscode-typescript-next",
    "streetsidesoftware.code-spell-checker",
    "eamodio.gitlens"
  ]
}
```

### Launch Configuration

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Server (STDIO)",
      "skipFiles": ["<node_internals>/**"],
      "program": "${workspaceFolder}/dist/index.js",
      "outFiles": ["${workspaceFolder}/dist/**/*.js"],
      "preLaunchTask": "npm: build"
    },
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Server (SSE)",
      "skipFiles": ["<node_internals>/**"],
      "program": "${workspaceFolder}/dist/index.js",
      "args": ["sse", "-p", "6111", "--log-level", "debug"],
      "outFiles": ["${workspaceFolder}/dist/**/*.js"],
      "preLaunchTask": "npm: build"
    },
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Tests",
      "skipFiles": ["<node_internals>/**"],
      "program": "${workspaceFolder}/node_modules/vitest/vitest.mjs",
      "args": ["run", "${file}"],
      "cwd": "${workspaceFolder}",
      "console": "internalConsole"
    }
  ]
}
```

### Tasks Configuration

Create `.vscode/tasks.json`:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "type": "npm",
      "script": "build",
      "group": {
        "kind": "build",
        "isDefault": true
      },
      "problemMatcher": "$tsc",
      "label": "npm: build"
    },
    {
      "type": "npm",
      "script": "dev",
      "problemMatcher": [],
      "label": "npm: dev"
    },
    {
      "type": "npm",
      "script": "test",
      "group": {
        "kind": "test",
        "isDefault": true
      },
      "label": "npm: test"
    }
  ]
}
```

## Environment Variables

### Development Environment

**There is no `.env` support.** Nothing in `src/`, `scripts/` or `vitest.config.ts` loads one,
and `dotenv` is not a dependency — a `.env` file you create will simply be ignored. Set variables
in your shell, or use the CLI flags where they exist:

```bash
# Logging: prefer the flags, which are read directly by the CLI
node dist/index.js stdio --log-level debug --log-file /tmp/mcp.log

# Or export for the process you launch
export DEBUG_MCP_LOG_LEVEL=debug
export PYTHON_PATH=python
```

`TEST_TIMEOUT` is not read from the environment anywhere in the repo — where it appears it is a
module-local constant inside an individual test file. Test timeouts are configured in
`vitest.config.ts` (15s for the `unit` project, 30s for `integration`/`e2e`).

### Available Environment Variables

The complete runtime-affecting set lives in the [Diagnostics guide's environment variable reference](../diagnostics.md#environment-variable-reference) — that table is canonical. Development-relevant highlights:

| Variable | Description | Default |
|----------|-------------|---------|
| `DEBUG_MCP_LOG_LEVEL` | Logging level (error, warn, info, debug) | `info` |
| `PYTHON_PATH` | Path to Python executable | Auto-detected |
| `PYTHON_EXECUTABLE` | Alternative to `PYTHON_PATH` for Python executable path (checked as fallback) | Auto-detected |
| `GOBIN` | Searched first for the Delve debugger (Go), before `GOPATH/bin` and PATH | Not set |
| `NETCOREDBG_PATH` | Path to netcoredbg (.NET) | Auto-detected |
| `JAVA_HOME` | Path to JDK installation (Java) | Auto-detected |
| `DEBUG` | Enable debug output (e.g., `DEBUG=debug-mcp:*`) | Not set |
| `DAP_TRACE` | Set to `1` to trace every DAP frame to a per-session `dap-trace-<sessionId>.ndjson` (capped at 50 MB; records tagged with the originating connection via `conn`) | Not set |
| `DAP_TRACE_FILE` | Explicit DAP trace file path (implies tracing on) | Not set |
| `MCP_SKIP_ORPHAN_REAPERS` | Set to `1` to skip the startup orphan-process scans (e.g. PID-namespaced containers where orphans are impossible) | Not set |
| `DAP_MAX_FRAME_BYTES` | Upper bound for a single DAP frame body accepted by the frame decoder | 64 MB |

## Troubleshooting Setup Issues

### Node.js Issues

**Problem**: `npm install` fails with permission errors

**Solution**:
```bash
# On Unix/macOS
sudo npm install -g npm@latest

# On Windows (run as Administrator)
npm install -g npm@latest
```

**Problem**: Node version is too old

**Solution**: Use nvm (Node Version Manager):
```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Install and use Node 22
nvm install 22
nvm use 22
```

### Python Issues

**Problem**: `debugpy` not found

**Solution**:
```bash
# Ensure pip is up to date
python -m pip install --upgrade pip

# Install debugpy
python -m pip install debugpy

# Verify installation
python -c "import debugpy; print(debugpy.__version__)"
```

**Problem**: Multiple Python versions

**Solution**: Set `PYTHON_PATH` environment variable:
```bash
# Unix/macOS
export PYTHON_PATH=/usr/bin/python3

# Windows
set PYTHON_PATH=C:\Python39\python.exe
```

### Build Issues

**Problem**: TypeScript compilation errors

**Solution**:
```bash
# Clean and rebuild
npm run build:clean
pnpm install
npm run build
```

**Problem**: Module resolution errors

**Solution**:
```bash
# Clear Node.js cache
npm cache clean --force

# Reinstall dependencies
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

## Development Best Practices

### 1. Code Style

The project uses ESLint and Prettier for code formatting:

```bash
# Check code style
npm run lint

# Fix automatically
npm run lint:fix
```

### 2. Commit Messages

Follow conventional commit format:
```
type(scope): subject

body

footer
```

Examples:
```
feat(session): add timeout configuration
fix(proxy): handle connection errors properly
docs(api): update endpoint documentation
test(integration): add Python 3.11 tests
```

### 3. Branch Naming

- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation updates
- `test/description` - Test additions/fixes
- `refactor/description` - Code refactoring

### 4. Testing

Always write tests for new features:

```typescript
// Unit test example
describe('MyComponent', () => {
  it('should handle specific case', () => {
    // Arrange
    const component = new MyComponent(mockDependencies);
    
    // Act
    const result = component.doSomething();
    
    // Assert
    expect(result).toBe(expectedValue);
  });
});
```

### 5. Documentation

Update documentation when adding features:
- API changes → Update component docs
- New patterns → Add to pattern docs
- User-facing changes → Update README

## Next Steps

1. Read the [Testing Guide](./testing-guide.md) to understand the test suite
2. Review the [Architecture Overview](../architecture/system-overview.md)
3. Check [Contributing Guidelines](../../CONTRIBUTING.md) before submitting PRs
4. Join the development discussion on [GitHub Issues](https://github.com/debugmcp/mcp-debugger/issues)

## Getting Help

- **Documentation**: Check the `docs/` directory
- **Examples**: See `examples/` for usage examples
- **Issues**: Report bugs on GitHub
- **Discussions**: Use GitHub Discussions for questions

Happy coding! 🚀
