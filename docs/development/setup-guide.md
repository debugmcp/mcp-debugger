# MCP Debug Server - Development Setup Guide

This guide will help you set up your development environment for working on the MCP Debug Server project.

## Prerequisites

### Required Software

1. **Node.js** (v18.0.0 or higher, 20.x recommended)
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
git clone https://github.com/your-username/debug-mcp-server.git
cd debug-mcp-server
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
│   ├── adapter-python/    # Python debug adapter (debugpy)
│   ├── adapter-javascript/# JavaScript/Node.js adapter (js-debug)
│   ├── adapter-rust/      # Rust adapter (CodeLLDB)
│   ├── adapter-go/        # Go adapter (Delve)
│   ├── adapter-java/      # Java debug adapter (JDI)
│   ├── adapter-mock/      # Mock adapter for testing
│   └── mcp-debugger/      # Self-contained CLI bundle (npx distribution)
├── src/                    # Core server source code
│   ├── adapters/          # Adapter loading and registry
│   ├── cli/               # CLI commands and setup
│   ├── container/         # Dependency injection
│   ├── proxy/             # DAP proxy components
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
# Development build (watch mode)
npm run dev

# Production build
npm run build

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
```

### Running the Server Locally

#### STDIO Mode (Default)

```bash
node dist/index.js stdio
```

#### SSE Mode

```bash
node dist/index.js sse -p 3001
```

#### With Debug Logging

```bash
node dist/index.js sse -p 3001 --log-level debug --log-file ./logs/debug.log
```

Note: Console output is unconditionally silenced at process startup for all transport modes (STDIO and SSE) to prevent any stray output from corrupting protocol communication. Use `--log-file` to capture logs.

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
      "group": "build",
      "problemMatcher": "$tsc-watch",
      "isBackground": true,
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

Create a `.env` file for development:

```bash
# Logging
DEBUG_MCP_LOG_LEVEL=debug

# Python
PYTHON_PATH=python

# Testing
TEST_TIMEOUT=30000
```

### Available Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DEBUG_MCP_LOG_LEVEL` | Logging level (error, warn, info, debug) | `info` |
| `PYTHON_PATH` | Path to Python executable | Auto-detected |
| `PYTHON_EXECUTABLE` | Alternative to `PYTHON_PATH` for Python executable path (checked as fallback) | Auto-detected |
| `DLV_PATH` | Path to Delve debugger (Go) | Auto-detected |
| `NETCOREDBG_PATH` | Path to netcoredbg (.NET) | Auto-detected |
| `JAVA_HOME` | Path to JDK installation (Java) | Auto-detected |
| `DEBUG` | Enable debug output (e.g., `DEBUG=debug-mcp:*`) | Not set |

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

# Install and use Node 18
nvm install 18
nvm use 18
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
4. Join the development discussion on [GitHub Issues](https://github.com/your-username/debug-mcp-server/issues)

## Getting Help

- **Documentation**: Check the `docs/` directory
- **Examples**: See `examples/` for usage examples
- **Issues**: Report bugs on GitHub
- **Discussions**: Use GitHub Discussions for questions

Happy coding! 🚀
