# mcp-debugger

<div align="center">
  <img src="assets/logo.png" alt="MCP Debugger Logo - A stylized circuit board with debug breakpoints" width="400" height="400">
</div>

**MCP server for multi-language debugging – give your AI agents debugging superpowers** 🚀

[![CI](https://github.com/debugmcp/mcp-debugger/actions/workflows/ci.yml/badge.svg)](https://github.com/debugmcp/mcp-debugger/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/debugmcp/mcp-debugger/branch/main/graph/badge.svg)](https://codecov.io/gh/debugmcp/mcp-debugger)
[![npm version](https://img.shields.io/npm/v/@debugmcp/mcp-debugger.svg)](https://www.npmjs.com/package/@debugmcp/mcp-debugger)
[![Docker Pulls](https://img.shields.io/docker/pulls/debugmcp/mcp-debugger.svg)](https://hub.docker.com/r/debugmcp/mcp-debugger)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

## 🎯 Overview

mcp-debugger is a Model Context Protocol (MCP) server that provides debugging tools as structured API calls. It enables AI agents to perform step-through debugging of multiple programming languages using the Debug Adapter Protocol (DAP).

> 🆕 Version 0.19.0: Java debugging via JDI bridge with launch and attach modes! Plus Go debugging with Delve.

> 🆕 Version 0.17.0: Rust debugging support! Debug Rust programs with CodeLLDB on Linux/macOS, including Cargo projects, async code, and full variable inspection—plus step commands now return the active source context so agents keep their place automatically.

> 🔥 Version 0.16.0: JavaScript/Node.js debugging support! Full debugging capabilities with bundled js-debug, TypeScript support, and zero-runtime dependencies via improved npx distribution.

> 🎬 **Demo Video**: See the debugger in action!
> 
> *Recording in progress - This will show an AI agent discovering and fixing the variable swap bug in real-time*
> 
> <!-- To capture this demo, see examples/visualizer/demo_script.md -->
> <!-- Uncomment when demo.gif is available:
> <div align="center">
>   <img src="assets/demo.gif" alt="MCP Debugger Demo - AI agent debugging Python code">
>   <br>
>   <em>AI agent discovering and fixing a variable swap bug in real-time</em>
> </div>
> -->

## ✨ Key Features

- 🌐 **Multi-language support** – Clean adapter pattern for any language
- 🐍 **Python debugging via debugpy** – Full DAP protocol support
- 🟨 **JavaScript (Node.js) debugging via js-debug** – VSCode's proven debugger
- 🦀 **Rust debugging via CodeLLDB** – Debug Rust & Cargo projects (Linux/macOS/Windows with GNU toolchain)
- 🐹 **Go debugging via Delve** – Full DAP support for Go programs
- ☕ **Java debugging via JDI bridge** – Launch and attach modes with JDK 21+
- 🔷 **.NET/C# debugging via netcoredbg** – Debug .NET applications with full DAP support
> WARNING: On Windows, use the GNU toolchain for full variable inspection. Run `mcp-debugger check-rust-binary <path-to-exe>` to verify your build and see [Rust Debugging on Windows](docs/rust-debugging-windows.md) for detailed guidance.
> NOTE: The published npm bundle ships the Linux x64 CodeLLDB runtime to stay under registry size limits. On macOS or Windows, point the `CODELLDB_PATH` environment variable at an existing CodeLLDB installation (for example from the VSCode extension) or clone the repo and run `pnpm --filter @debugmcp/adapter-rust run build:adapter` to vendor your platform binaries locally.

### Windows Rust Setup Script

If you're on Windows and want the quickest path to a working GNU toolchain + dlltool configuration, run:

```powershell
pwsh scripts/setup/windows-rust-debug.ps1
```

The script installs the `stable-gnu` toolchain (via rustup), sets up `dlltool.exe` (preferring MSYS2/MinGW when available, falling back to rustup's self-contained copy), builds the bundled Rust examples, and runs the Rust smoke tests by default. Add `-SkipTests` to opt out of running tests. Add `-UpdateUserPath` if you want the dlltool path persisted to your user PATH/DLLTOOL variables.

The script will also attempt to provision an MSYS2-based MinGW-w64 toolchain (via winget + pacman) so `cargo +stable-gnu` has a fully functional `dlltool/ld/as` stack. If MSYS2 is already installed, it simply reuses it; otherwise it guides you through installing it (or warns so you can install manually).
- 🧪 **Mock adapter for testing** – Test without external dependencies
- 🔌 **STDIO and SSE transport modes** – Works with any MCP client
- 📦 **Zero-runtime dependencies** – Self-contained bundles via esbuild + tsup
- ⚡ **npx ready** – Run directly with `npx @debugmcp/mcp-debugger` - no installation needed
- 📊 **1266+ tests passing** – battle-tested end-to-end
- 🐳 **Docker and npm packages** – Deploy anywhere
- 🤖 **Built for AI agents** – Structured JSON responses for easy parsing
- 🛡️ **Path validation** – Prevents crashes from non-existent files
- 📝 **AI-aware line context** – Intelligent breakpoint placement with code context

## 🚀 Quick Start

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

> ⚠️ The Docker image ships Python, JavaScript, Go, Java, and .NET adapters. Rust debugging requires the local, SSE, or packed deployments where the adapter runs next to your toolchain. Note: adapters are loaded dynamically at runtime — only those whose toolchain is installed and detected will be reported as available by `list_supported_languages`.

### Using npm

```bash
npm install -g @debugmcp/mcp-debugger
mcp-debugger --help
```

Or use without installation via npx:
```bash
npx @debugmcp/mcp-debugger --help
```

> 📸 **Screenshot**: *MCP Integration in Action*
> 
> This screenshot will show real-time MCP protocol communication with tool calls and JSON responses flowing between the AI agent and debugger.
> 
> <!-- To capture this screenshot, see examples/visualizer/capture_guide.md -->
> <!-- Uncomment when mcp-integration.png is available:
> ![MCP Integration](assets/screenshots/mcp-integration.png)
> *Real-time MCP protocol communication showing tool calls and responses*
> -->

## 📚 How It Works

mcp-debugger exposes debugging operations as MCP tools that can be called with structured JSON parameters:

```json
// Tool: create_debug_session
// Request:
{
  "language": "python",  // or "javascript", "rust", "go", "java", "dotnet", or "mock" for testing
  "name": "My Debug Session"
}
// Response:
{
  "success": true,
  "sessionId": "a4d1acc8-84a8-44fe-a13e-28628c5b33c7",
  "message": "Created python debug session: My Debug Session"
}
```

> 📸 **Screenshot**: *Active Debugging Session*
> 
> This screenshot will show the debugger paused at a breakpoint with the stack trace visible in the left panel, local variables in the right panel, and source code with line highlighting in the center.
> 
> <!-- To capture this screenshot, see examples/visualizer/capture_guide.md -->
> <!-- Uncomment when debugging-session.png is available:
> ![Debugging Session](assets/screenshots/debugging-session.png)
> *Active debugging session paused at a breakpoint with stack trace visible*
> -->

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

> 📸 **Screenshot**: *Multi-Session Debugging*
> 
> This screenshot will show the debugger managing multiple concurrent debug sessions, demonstrating how AI agents can debug different scripts simultaneously with isolated session management.
> 
> <!-- To capture this screenshot, see examples/visualizer/capture_guide.md -->
> <!-- Uncomment when multi-session.png is available:
> ![Multi-session Debugging](assets/screenshots/multi-session.png)
> *Managing multiple debug sessions simultaneously*
> -->

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
                          ┌──────────────┴──────────────────────────────────────────┐
                          │                                                          │
              ┌───────────┼───────────┬───────────┬───────────┬───────────┐          │
              │           │           │           │           │           │          │
        ┌─────▼────┐┌─────▼────┐┌─────▼────┐┌─────▼────┐┌─────▼────┐┌─────▼────┐
        │Python    ││JavaScript││Rust      ││Go        ││Java      ││Dotnet    ││Mock      │
        │Adapter   ││Adapter   ││Adapter   ││Adapter   ││Adapter   ││Adapter   ││Adapter   │
        └──────────┘└──────────┘└──────────┘└──────────┘└──────────┘└──────────┘└──────���───┘
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

> 📸 **Screenshot**: *Variable Inspection Reveals the Bug*
> 
> This screenshot will show the TUI visualizer after stepping over line 4, where both variables incorrectly show value 20, clearly demonstrating the variable swap bug. The left panel shows the execution state, the center shows the highlighted code, and the right panel displays the incorrect variable values.
> 
> <!-- To capture this screenshot, see examples/visualizer/capture_guide.md -->
> <!-- Uncomment when variable-inspection.png is available:
> ![Variable Inspection](assets/screenshots/variable-inspection.png)
> *After stepping over line 4, both variables incorrectly show value 20*
> -->

## 📖 Documentation

- 📘 [Tool Reference](./docs/tool-reference.md) – Complete API documentation
- 🚦 [Getting Started Guide](./docs/getting-started.md) – First-time setup
- 🏗️ [Architecture Overview](./docs/architecture/README.md) – Multi-language design
- 🔧 [Adapter Development](./docs/architecture/adapter-development-guide.md) – Add new languages
- 🔌 [Dynamic Loading Architecture](./docs/architecture/dynamic-loading-architecture.md) – Runtime discovery, lazy loading, caching
- 🧩 [Adapter API Reference](./docs/architecture/adapter-api-reference.md) – Adapter, factory, loader, and registry contracts
- 🔄 [Migration Guide](./docs/migration-guide.md) – Upgrading to v0.15.0 (dynamic loading)
- 🐍 [Python Debugging Guide](./docs/python/README.md) – Python-specific features
- 🟨 [JavaScript Debugging Guide](./docs/javascript/README.md) – JavaScript/TypeScript features
- 🐹 [Go Debugging Guide](./docs/go/README.md) – Go debugging with Delve
- ☕ [Java Debugging Guide](./docs/java/README.md) – Java debugging with JDI bridge
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

- ✅ **Production Ready**: v0.19.0 with six language adapters and polished multi-language distribution
- ✅ **Clean architecture** with adapter pattern
- ✅ **JavaScript/Node.js**: Full debugging loop via js-debug
- ✅ **Go**: Full debugging support via Delve DAP
- ✅ **Java**: Launch and attach modes via JDI bridge
- 🦀 **Rust**: Full support on Linux/macOS/Windows (Windows requires GNU toolchain; MSVC is not supported by CodeLLDB)
- 📈 **Active Development**: Regular updates and improvements

## 📄 License

MIT License - see [LICENSE](./LICENSE) for details.

## 👥 Contributors

- [@swinyx](https://github.com/swinyx) — Go adapter (Delve)
- [@roofpig95008](https://github.com/roofpig95008) — Java adapter (JDI bridge)

## 🙏 Acknowledgments

Built with:
- [Model Context Protocol](https://github.com/anthropics/model-context-protocol) by Anthropic
- [Debug Adapter Protocol](https://microsoft.github.io/debug-adapter-protocol/) by Microsoft
- [debugpy](https://github.com/microsoft/debugpy) for Python debugging

---

**Give your AI the power to debug like a developer – in any language!** 🎯
