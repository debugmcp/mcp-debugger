# mcp-debugger

<div align="center">
  <img src="assets/logo.png" alt="MCP Debugger Logo - A stylized circuit board with debug breakpoints" width="400" height="400">
</div>

**A headless, agentic debugger over MCP — let your AI agents debug running programs in seven languages.**

[![CI](https://github.com/debugmcp/mcp-debugger/actions/workflows/ci.yml/badge.svg)](https://github.com/debugmcp/mcp-debugger/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/debugmcp/mcp-debugger/branch/main/graph/badge.svg)](https://codecov.io/gh/debugmcp/mcp-debugger)
[![npm version](https://img.shields.io/npm/v/@debugmcp/mcp-debugger.svg)](https://www.npmjs.com/package/@debugmcp/mcp-debugger)
[![Docker Pulls](https://img.shields.io/docker/pulls/debugmcp/mcp-debugger.svg)](https://hub.docker.com/r/debugmcp/mcp-debugger)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/debugmcp/mcp-debugger/badge)](https://scorecard.dev/viewer/?uri=github.com/debugmcp/mcp-debugger)
[![OpenSSF Best Practices](https://www.bestpractices.dev/projects/13543/badge)](https://www.bestpractices.dev/projects/13543)

## 🎯 Overview

mcp-debugger is a Model Context Protocol (MCP) server that exposes step-through debugging as structured tool calls. It lets AI agents set breakpoints, inspect variables, evaluate expressions, and step through running programs across seven languages — driving real language debuggers through the Debug Adapter Protocol (DAP).

> 🆕 **v0.22.0** — **Ruby debugging support** lands (launch + attach via `rdbg`, including remote attach to containers and Kubernetes pods), alongside JavaScript attach-mode fixes and session/proxy lifecycle hardening. See the [CHANGELOG](./CHANGELOG.md) for the full release history.

## ✨ Key Features

- 🌐 **Multi-language support** – Clean adapter pattern for any language
- 🐍 **Python debugging via debugpy** – Full DAP protocol support
- 💎 **Ruby debugging via rdbg** – Launch and attach workflows, including remote attach to containers and Kubernetes pods
- 🟨 **JavaScript (Node.js) debugging via js-debug** – VSCode's proven debugger
- 🦀 **Rust debugging via CodeLLDB** – Debug Rust & Cargo projects (Linux/macOS; Windows needs the GNU toolchain — see [Rust on Windows](docs/rust-debugging-windows.md))
- 🐹 **Go debugging via Delve** – Full DAP support for Go programs
- ☕ **Java debugging via JDI bridge** – Launch and attach modes with JDK 21+
- 🔷 **.NET/C# debugging via netcoredbg** – Debug .NET applications with full DAP support
- 🧪 **Mock adapter for testing** – Test without external dependencies
- 🛰️ **Out-of-IDE & remote attach** – Attach over host/port to a process on another machine or inside a container (Python via debugpy, Ruby via rdbg, Java via JDWP), with source-path mapping
- 🔌 **STDIO and Streamable HTTP transports** – Works with any MCP client (legacy SSE transport is deprecated)
- 📦 **Zero-runtime dependencies** – Self-contained bundles via esbuild + tsup
- ⚡ **npx ready** – Run directly with `npx @debugmcp/mcp-debugger` - no installation needed
- 🐳 **Docker and npm packages** – Deploy anywhere
- 🤖 **Built for AI agents** – Structured JSON responses for easy parsing
- 🛡️ **Path validation** – Prevents crashes from non-existent files
- 📝 **AI-aware line context** – Intelligent breakpoint placement with code context
- ✅ **Comprehensive test suite** – unit, integration, and end-to-end coverage across every adapter ([CI status](https://github.com/debugmcp/mcp-debugger/actions/workflows/ci.yml))

## 🚀 Quick Start

> **Requirements:** Node.js 22+ for the server. Each language you debug also needs its own toolchain installed (Python + debugpy, Ruby + the `debug` gem / `rdbg`, Node.js, Go + Delve, JDK 21+, .NET SDK, or the Rust toolchain).

### For MCP Clients (Claude Desktop, etc.)

Add to your MCP settings configuration:

```json
{
  "mcpServers": {
    "mcp-debugger": {
      "command": "node",
      "args": ["C:/path/to/mcp-debugger/dist/index.js", "stdio", "--log-level", "debug", "--log-file", "C:/path/to/logs/debug-mcp-server.log"],
      "disabled": false,
      "autoApprove": ["create_debug_session", "set_breakpoint", "get_variables"]
    }
  }
}
```

### For Claude Code CLI

For Claude Code users, we provide an automated installation script:

> **Prerequisite**: The Claude CLI must be installed and available on your PATH before running the installation script. See [Claude Code documentation](https://claude.ai/code) for installation instructions.

```bash
# Clone the repository
git clone https://github.com/debugmcp/mcp-debugger.git
cd mcp-debugger

# Run the installation script
./scripts/install-claude-mcp.sh

# Verify the connection (use 'claude mcp list' if claude is on your PATH)
claude mcp list
```

**Important**: The `stdio` argument is required to prevent console output from corrupting the JSON-RPC protocol. See [CLAUDE.md](CLAUDE.md) for detailed setup and troubleshooting.

### Using Docker

```bash
docker run -v $(pwd):/workspace debugmcp/mcp-debugger:latest
```

> ⚠️ The Docker image bundles the toolchains for **Python, JavaScript, and Java** debugging (Rust, Go, and .NET are disabled inside the container image, and the image does not include a Ruby runtime). For those languages, run the server via npm/npx next to your local toolchain — or, for Ruby, use remote attach to a `rdbg --open` process inside the container (see the [Ruby guide](./docs/ruby/README.md)). Adapters load dynamically at runtime — `list_supported_languages` reports only those whose toolchain is detected.

### Using npm

```bash
npm install -g @debugmcp/mcp-debugger
mcp-debugger --help
```

Or use without installation via npx:
```bash
npx @debugmcp/mcp-debugger --help
```

## 📚 How It Works

mcp-debugger exposes debugging operations as MCP tools that can be called with structured JSON parameters:

```json
// Tool: create_debug_session
// Request:
{
  "language": "python",  // or "ruby", "javascript", "rust", "go", "java", "dotnet", or "mock" for testing
  "name": "My Debug Session"
}
// Response:
{
  "success": true,
  "sessionId": "a4d1acc8-84a8-44fe-a13e-28628c5b33c7",
  "message": "Created python debug session: My Debug Session"
}
```

## 🛠️ Available Tools

| Tool | Description | Status |
|------|-------------|--------|
| `create_debug_session` | Create a new debugging session | ✅ Implemented |
| `list_debug_sessions` | List all active sessions | ✅ Implemented |
| `list_supported_languages` | Show available language adapters | ✅ Implemented |
| `set_breakpoint` | Set a breakpoint in a file | ✅ Implemented |
| `start_debugging` | Start debugging a script | ✅ Implemented |
| `attach_to_process` | Attach debugger to a running process | ✅ Implemented |
| `detach_from_process` | Detach debugger from a process | ✅ Implemented |
| `get_stack_trace` | Get the current stack trace | ✅ Implemented |
| `list_threads` | List all threads in the debug session | ✅ Implemented |
| `get_scopes` | Get variable scopes for a frame | ✅ Implemented |
| `get_variables` | Get variables in a scope | ✅ Implemented |
| `get_local_variables` | Get local variables in current frame | ✅ Implemented |
| `step_over` | Step over the current line | ✅ Implemented |
| `step_into` | Step into a function | ✅ Implemented |
| `step_out` | Step out of a function | ✅ Implemented |
| `continue_execution` | Continue running | ✅ Implemented |
| `pause_execution` | Pause running execution | ✅ Implemented |
| `evaluate_expression` | Evaluate expressions in debug context | ✅ Implemented |
| `get_source_context` | Get source code context | ✅ Implemented |
| `close_debug_session` | Close a session | ✅ Implemented |
| `redefine_classes` | Hot-swap changed Java classes into a running JVM (Java only) | ✅ Implemented |

## 🏗️ Architecture: Dynamic Adapter Loading

Version 0.10.0 introduces a clean adapter pattern that separates language-agnostic core functionality from language-specific implementations:

```
┌─────────────┐     ┌────────────────┐     ┌──────────────┐     ┌─────────────────┐
│ MCP Client  │────▶│ DebugMcpServer │────▶│SessionManager│────▶│ AdapterRegistry │
└─────────────┘     └────────────────┘     └──────────────┘     └─────────────────┘
                            │                      │
                            ▼                      ▼
                    ┌──────────────┐      ┌─────────────────┐
                    │ ProxyManager │◀─────│ Language Adapter│
                    └──────────────┘      └─────────────────┘
                                                  │
              ┌───────────┬───────────┬───────────┼───────────┬───────────┬───────────┬───────────┐
              │           │           │           │           │           │           │           │
        ┌─────▼────┐┌─────▼────┐┌─────▼────┐┌─────▼────┐┌─────▼────┐┌─────▼────┐┌─────▼────┐┌─────▼────┐
        │Python    ││Ruby      ││JavaScript││Rust      ││Go        ││Java      ││.NET      ││Mock      │
        │Adapter   ││Adapter   ││Adapter   ││Adapter   ││Adapter   ││Adapter   ││Adapter   ││Adapter   │
        └──────────┘└──────────┘└──────────┘└──────────┘└──────────┘└──────────┘└──────────┘└──────────┘
```

### Adding Language Support

Want to add debugging support for your favorite language? Check out the [Adapter Development Guide](./docs/architecture/adapter-development-guide.md)!

## 💡 Example: Debugging Python Code

Here's a complete debugging session example:

```python
# buggy_swap.py
def swap_variables(a, b):
    a = b  # Bug: loses original value of 'a'
    b = a  # Bug: 'b' gets the new value of 'a'
    return a, b
```

### Step 1: Create a Debug Session

```json
// Tool: create_debug_session
// Request:
{
  "language": "python",
  "name": "Swap Bug Investigation"
}
// Response:
{
  "success": true,
  "sessionId": "a4d1acc8-84a8-44fe-a13e-28628c5b33c7",
  "message": "Created python debug session: Swap Bug Investigation"
}
```

### Step 2: Set Breakpoints

```json
// Tool: set_breakpoint
// Request:
{
  "sessionId": "a4d1acc8-84a8-44fe-a13e-28628c5b33c7",
  "file": "buggy_swap.py",
  "line": 2
}
// Response:
{
  "success": true,
  "breakpointId": "28e06119-619e-43c0-b029-339cec2615df",
  "file": "C:\\path\\to\\buggy_swap.py",
  "line": 2,
  "verified": false,
  "message": "Breakpoint set at C:\\path\\to\\buggy_swap.py:2"
}
```

### Step 3: Start Debugging

```json
// Tool: start_debugging
// Request:
{
  "sessionId": "a4d1acc8-84a8-44fe-a13e-28628c5b33c7",
  "scriptPath": "buggy_swap.py"
}
// Response:
{
  "success": true,
  "state": "paused",
  "message": "Debugging started for buggy_swap.py. Current state: paused",
  "data": {
    "message": "Debugging started for buggy_swap.py. Current state: paused",
    "reason": "breakpoint"
  }
}
```

### Step 4: Inspect Variables

First, get the scopes:

```json
// Tool: get_scopes
// Request:
{
  "sessionId": "a4d1acc8-84a8-44fe-a13e-28628c5b33c7",
  "frameId": 3
}
// Response:
{
  "success": true,
  "scopes": [
    {
      "name": "Locals",
      "variablesReference": 5,
      "expensive": false,
      "presentationHint": "locals",
      "source": {}
    },
    {
      "name": "Globals", 
      "variablesReference": 6,
      "expensive": false,
      "source": {}
    }
  ]
}
```

Then get the local variables:

```json
// Tool: get_variables
// Request:
{
  "sessionId": "a4d1acc8-84a8-44fe-a13e-28628c5b33c7",
  "scope": 5
}
// Response:
{
  "success": true,
  "variables": [
    {"name": "a", "value": "10", "type": "int", "variablesReference": 0, "expandable": false},
    {"name": "b", "value": "20", "type": "int", "variablesReference": 0, "expandable": false}
  ],
  "count": 2,
  "variablesReference": 5
}
```

## 📖 Documentation

- 📘 [Tool Reference](./docs/tool-reference.md) – Complete API documentation
- 🚦 [Getting Started Guide](./docs/getting-started.md) – First-time setup
- 🏗️ [Architecture Overview](./docs/architecture/README.md) – Multi-language design
- 🔧 [Adapter Development](./docs/architecture/adapter-development-guide.md) – Add new languages
- 🔌 [Dynamic Loading Architecture](./docs/architecture/dynamic-loading-architecture.md) – Runtime discovery, lazy loading, caching
- 🧩 [Adapter API Reference](./docs/architecture/adapter-api-reference.md) – Adapter, factory, loader, and registry contracts
- 🔄 [Migration Guide](./docs/migration-guide.md) – Upgrading to v0.15.0 (dynamic loading)
- 🐍 [Python Debugging Guide](./docs/python/README.md) – Python-specific features
- 💎 [Ruby Debugging Guide](./docs/ruby/README.md) – Ruby debugging with `rdbg`, including remote attach
- 🟨 [JavaScript Debugging Guide](./docs/javascript/README.md) – JavaScript/TypeScript features
- 🐹 [Go Debugging Guide](./docs/go/README.md) – Go debugging with Delve
- ☕ [Java Debugging Guide](./docs/java/README.md) – Java debugging with JDI bridge
- 🔷 [.NET Debugging Guide](./docs/dotnet/README.md) – .NET/C# debugging with netcoredbg
- [Rust Debugging on Windows](docs/rust-debugging-windows.md) - Toolchain requirements and troubleshooting
- 🔧 [Troubleshooting](./docs/troubleshooting.md) – Common issues & solutions

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

```bash
# Development setup
git clone https://github.com/debugmcp/mcp-debugger.git
cd mcp-debugger

# Install dependencies and vendor debug adapters
pnpm install
# All debug adapters (JavaScript js-debug, Rust CodeLLDB) are automatically downloaded

# Build the project
pnpm build

# Run tests
pnpm test

# Check adapter vendoring status
pnpm vendor:status

# Force re-vendor all adapters (if needed)
pnpm vendor:force
```

### Debug Adapter Vendoring

The project automatically vendors debug adapters during `pnpm install`:
- **JavaScript**: Downloads Microsoft's js-debug from GitHub releases
- **Rust**: Downloads CodeLLDB binaries for the current platform
- **CI Environment**: Set `SKIP_ADAPTER_VENDOR=true` to skip vendoring

To manually manage adapters:
```bash
# Check current vendoring status
pnpm vendor:status

# Re-vendor all adapters
pnpm vendor

# Clean and re-vendor (force)
pnpm vendor:force

# Clean vendor directories only
pnpm clean:vendor
```

### Running Container Tests Locally

We use [Act](https://github.com/nektos/act) to run GitHub Actions workflows locally:

```bash
# Build the Docker image first
docker build -t mcp-debugger:local .

# Run tests with Act (use WSL2 on Windows)
act -j build-and-test --matrix os:ubuntu-latest
```

See [tests/README.md](./tests/README.md) for detailed testing instructions.

## 📊 Project Status

- ✅ **Production Ready**: v0.22.0 with seven language adapters and polished multi-language distribution
- ✅ **Clean architecture** with a dynamic adapter pattern
- ✅ **Python · Ruby · JavaScript/TypeScript · Go · Java · .NET/C#**: Full step-through debugging
- 🦀 **Rust**: Full support on Linux/macOS/Windows (Windows requires the GNU toolchain; MSVC is not supported by CodeLLDB)
- 🟢 **Runtime**: Node.js 22+
- 📈 **Active Development**: Regular updates and improvements

## 📄 License

MIT License - see [LICENSE](./LICENSE) for details.

## 👥 Contributors

- [@Poyraxx](https://github.com/Poyraxx) — Ruby adapter (rdbg)
- [@swinyx](https://github.com/swinyx) — Go adapter (Delve)
- [@roofpig95008](https://github.com/roofpig95008) — Java adapter (JDI bridge)

## 🙏 Acknowledgments

Built with:
- [Model Context Protocol](https://github.com/anthropics/model-context-protocol) by Anthropic
- [Debug Adapter Protocol](https://microsoft.github.io/debug-adapter-protocol/) by Microsoft
- [debugpy](https://github.com/microsoft/debugpy) for Python debugging
- [debug](https://github.com/ruby/debug) for Ruby debugging

---

**Give your AI agents a real debugger — in any language.**
