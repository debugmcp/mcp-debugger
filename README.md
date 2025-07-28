# mcp-debugger

<div align="center">
  <img src="assets/logo.png" alt="MCP Debugger Logo - A stylized circuit board with debug breakpoints" width="400" height="400">
</div>

**MCP server for multi-language debugging – give your AI agents debugging superpowers** 🚀

[![CI](https://github.com/debugmcp/mcp-debugger/actions/workflows/ci.yml/badge.svg)](https://github.com/debugmcp/mcp-debugger/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/badge/coverage-90%25+-brightgreen.svg)](./COVERAGE_SUMMARY.md)
[![npm version](https://img.shields.io/npm/v/@debugmcp/mcp-debugger.svg)](https://www.npmjs.com/package/@debugmcp/mcp-debugger)
[![Docker Pulls](https://img.shields.io/docker/pulls/debugmcp/mcp-debugger.svg)](https://hub.docker.com/r/debugmcp/mcp-debugger)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

## 🎯 Overview

mcp-debugger is a Model Context Protocol (MCP) server that provides debugging tools as structured API calls. It enables AI agents to perform step-through debugging of multiple programming languages using the Debug Adapter Protocol (DAP).

> **🆕 Version 0.10.0**: Now supports multiple languages through a clean adapter pattern! Start with Python, extend to any language.

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
- 🧪 **Mock adapter for testing** – Test without external dependencies
- 🔄 **STDIO and SSE transport modes** – Works with any MCP client
- 📊 **99.5% test coverage** – Battle-tested with 808+ passing tests
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
      "args": ["C:/path/to/mcp-debugger/dist/index.js", "--log-level", "debug", "--log-file", "C:/path/to/logs/debug-mcp-server.log"],
      "disabled": false,
      "autoApprove": ["create_debug_session", "set_breakpoint", "get_variables"]
    }
  }
}
```

### Using Docker

```bash
docker run -v $(pwd):/workspace debugmcp/mcp-debugger:0.10.0
```

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
  "language": "python",  // or "mock" for testing
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
| `set_breakpoint` | Set a breakpoint in a file | ✅ Implemented |
| `start_debugging` | Start debugging a script | ✅ Implemented |
| `get_stack_trace` | Get the current stack trace | ✅ Implemented |
| `get_scopes` | Get variable scopes for a frame | ✅ Implemented |
| `get_variables` | Get variables in a scope | ✅ Implemented |
| `step_over` | Step over the current line | ✅ Implemented |
| `step_into` | Step into a function | ✅ Implemented |
| `step_out` | Step out of a function | ✅ Implemented |
| `continue_execution` | Continue running | ✅ Implemented |
| `close_debug_session` | Close a session | ✅ Implemented |
| `pause_execution` | Pause running execution | ❌ Not Implemented |
| `evaluate_expression` | Evaluate expressions | ❌ Not Implemented |
| `get_source_context` | Get source code context | ✅ Implemented |

> 📸 **Screenshot**: *Multi-Session Debugging*
> 
> This screenshot will show the debugger managing multiple concurrent debug sessions, demonstrating how AI agents can debug different scripts simultaneously with isolated session management.
> 
> <!-- To capture this screenshot, see examples/visualizer/capture_guide.md -->
> <!-- Uncomment when multi-session.png is available:
> ![Multi-session Debugging](assets/screenshots/multi-session.png)
> *Managing multiple debug sessions simultaneously*
> -->

## 🏗️ Architecture: The Adapter Pattern

Version 0.10.0 introduces a clean adapter pattern that separates language-agnostic core functionality from language-specific implementations:

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│ MCP Client  │────▶│ SessionManager│────▶│ AdapterRegistry │
└─────────────┘     └──────────────┘     └─────────────────┘
                            │                      │
                            ▼                      ▼
                    ┌──────────────┐      ┌─────────────────┐
                    │ ProxyManager │◀─────│ Language Adapter│
                    └──────────────┘      └─────────────────┘
                                                   │
                                          ┌────────┴────────┐
                                          │                 │
                                    ┌─────▼──────┐   ┌─────▼──────┐
                                    │Python      │   │Mock        │
                                    │Adapter     │   │Adapter     │
                                    └────────────┘   └────────────┘
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
- 📊 [API Reference](./docs/architecture/api-reference.md) – Detailed interface docs
- 🔄 [Migration Guide](./docs/migration-guide.md) – Upgrading from v0.9.x
- 🐍 [Python Debugging Guide](./docs/python/README.md) – Python-specific features
- 🤖 [AI Integration Guide](./docs/ai-integration.md) – Leverage AI-friendly features
- 🔧 [Troubleshooting](./docs/troubleshooting.md) – Common issues & solutions

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

```bash
# Development setup
git clone https://github.com/debugmcp/mcp-debugger.git
cd mcp-debugger
npm install
npm run build
npm test
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

- ✅ **Production Ready**: v0.10.0 with multi-language support
- ✅ **808+ tests** with 99.5% success rate
- ✅ **Clean architecture** with adapter pattern
- 🚧 **Coming Soon**: Node.js, Go, and more language adapters
- 📈 **Active Development**: Regular updates and improvements

See [Roadmap.md](./Roadmap.md) for planned features.

## 📄 License

MIT License - see [LICENSE](./LICENSE) for details.

## 🙏 Acknowledgments

Built with:
- [Model Context Protocol](https://github.com/anthropics/model-context-protocol) by Anthropic
- [Debug Adapter Protocol](https://microsoft.github.io/debug-adapter-protocol/) by Microsoft
- [debugpy](https://github.com/microsoft/debugpy) for Python debugging

---

**Give your AI the power to debug like a developer – in any language!** 🎯
