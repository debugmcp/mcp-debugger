# mcp-debugger

**MCP server for step-through debugging – give your AI agents debugging superpowers** 🚀

[![CI](https://github.com/debugmcp/mcp-debugger/actions/workflows/ci.yml/badge.svg)](https://github.com/debugmcp/mcp-debugger/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/badge/coverage-90%25+-brightgreen.svg)](./COVERAGE_SUMMARY.md)
[![npm version](https://img.shields.io/npm/v/mcp-debugger.svg)](https://www.npmjs.com/package/mcp-debugger)
[![Docker Pulls](https://img.shields.io/docker/pulls/debugmcp/mcp-debugger.svg)](https://hub.docker.com/r/debugmcp/mcp-debugger)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

## 🎯 Overview

mcp-debugger is a Model Context Protocol (MCP) server that provides debugging tools as structured API calls. It enables AI agents to perform step-through debugging of Python scripts using the Debug Adapter Protocol (DAP).

## ✨ Key Features

- 🐍 **Python debugging via debugpy** – Full DAP protocol support
- 🔄 **STDIO and SSE transport modes** – Works with any MCP client
- 🧪 **>90% test coverage** – Battle-tested with 657+ passing tests
- 🐳 **Docker and npm packages** – Deploy anywhere
- 🤖 **Built for AI agents** – Structured JSON responses for easy parsing

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
docker run -v $(pwd):/workspace debugmcp/mcp-debugger:0.9.0
```

### Using npm

```bash
npm install -g mcp-debugger
mcp-debugger --help
```

## 📚 How It Works

mcp-debugger exposes debugging operations as MCP tools that can be called with structured JSON parameters:

```json
// Tool: create_debug_session
// Request:
{
  "language": "python",
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
| `get_source_context` | Get source code context | ❌ Not Implemented |

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
- 🐍 [Python Debugging Guide](./docs/python/README.md) – Python-specific features
- 🔧 [Troubleshooting](./docs/troubleshooting.md) – Common issues & solutions
- 🏗️ [Architecture](./docs/architecture/system-overview.md) – Technical deep-dive

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

## 📊 Project Status

- ✅ **Production Ready**: v0.9.0 with comprehensive test coverage
- 🚧 **Coming Soon**: Expression evaluation, conditional breakpoints
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

**Give your AI the power to debug like a developer!** 🎯
