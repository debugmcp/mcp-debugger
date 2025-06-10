# mcp-debugger

**LLM-driven debugger server – give your AI agents step-through debugging superpowers** 🚀

[![CI](https://github.com/debugmcp/mcp-debugger/actions/workflows/ci.yml/badge.svg)](https://github.com/debugmcp/mcp-debugger/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/badge/coverage-90%25+-brightgreen.svg)](./COVERAGE_SUMMARY.md)
[![npm version](https://img.shields.io/npm/v/mcp-debugger.svg)](https://www.npmjs.com/package/mcp-debugger)
[![Docker Pulls](https://img.shields.io/docker/pulls/debugmcp/mcp-debugger.svg)](https://hub.docker.com/r/debugmcp/mcp-debugger)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

## 🎬 Demo

Watch an LLM find and fix a bug using mcp-debugger:

![mcp-debugger demo](https://github.com/debugmcp/mcp-debugger/assets/demo/mcp-debugger-demo.gif)

*[Demo shows: Claude setting breakpoints, stepping through code, inspecting variables, and fixing a Python bug – all through natural language!]*

## 🚀 Quick Start

Get debugging in under a minute:

```bash
# Using Docker (recommended)
docker run -v $(pwd):/workspace debugmcp/mcp-debugger:0.9.0

# Or via npm
npm install -g mcp-debugger
mcp-debugger --help
```

## ✨ Key Features

- 🐍 **Python debugging via debugpy** – Full DAP protocol support
- 🔄 **STDIO and SSE transport modes** – Works with any MCP client
- 🧪 **>90% test coverage** – Battle-tested with 657+ passing tests
- 🐳 **Docker and PyPI packages** – Deploy anywhere
- 🤖 **Built for AI agents** – LangChain, AutoGPT, Claude, and more
- 🔍 **Smart Python detection** – Auto-finds Python installations
- 📊 **LLM-optimized output** – Clear, parseable debugging information

## 📖 How It Works

mcp-debugger implements the Model Context Protocol (MCP) to provide debugging tools that LLMs can use naturally:

```
LLM: "Set a breakpoint at line 10 in swap_vars.py"
mcp-debugger: ✓ Breakpoint set

LLM: "Run the script"
mcp-debugger: ⏸️ Paused at line 10

LLM: "Show me the local variables"
mcp-debugger: 📊 {'a': 10, 'b': 20}

LLM: "Step over"
mcp-debugger: ⏩ Now at line 11
```

## 🛠️ Installation & Setup

### For Claude Desktop / MCP Clients

Add to your MCP settings (`claude_desktop_config.json` or similar):

```json
{
  "mcpServers": {
    "mcp-debugger": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "-v", "${workspaceFolder}:/workspace", "debugmcp/mcp-debugger:0.9.0"],
      "disabled": false,
      "autoApprove": ["create_debug_session", "set_breakpoint", "get_variables"]
    }
  }
}
```

### For Development

```bash
# Clone the repository
git clone https://github.com/debugmcp/mcp-debugger.git
cd mcp-debugger

# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test
```

## 📚 Documentation

- 📖 [Getting Started Guide](./docs/getting-started.md) – First-time setup tutorial
- 🐍 [Python Debugging Guide](./docs/python/README.md) – Python-specific features
- 🔧 [Troubleshooting](./docs/troubleshooting.md) – Common issues & solutions
- 🤝 [Contributing](./CONTRIBUTING.md) – Join the development
- 🏗️ [Architecture](./docs/architecture/system-overview.md) – Technical deep-dive

## 💡 Example Usage

### Basic Python Debugging

```python
# buggy_code.py
def swap_variables(a, b):
    a = b  # Bug: loses original value of 'a'
    b = a  # Bug: 'b' gets the new value of 'a'
    return a, b
```

Tell your LLM:
> "Debug buggy_code.py and find why the swap function doesn't work correctly"

The LLM will:
1. Create a debug session
2. Set breakpoints at the buggy lines
3. Step through execution
4. Inspect variable values
5. Identify the issue and suggest a fix

### Advanced Features

- **Conditional breakpoints**: `"Set a breakpoint at line 15 when x > 100"`
- **Stack navigation**: `"Show me the call stack"`
- **Expression evaluation**: `"Evaluate len(data) in the current context"`
- **Multi-session debugging**: Debug multiple scripts simultaneously

## 🧩 Integration Examples

### LangChain
```python
from langchain.tools import MCPDebuggerTool

debugger = MCPDebuggerTool(server_url="tcp://localhost:6111")
agent.tools.append(debugger)
```

### AutoGPT
```yaml
# In your AutoGPT config
tools:
  - name: mcp-debugger
    transport: stdio
    command: docker run -i debugmcp/mcp-debugger:0.9.0
```

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

### Development Quick Start

```bash
# Run in development mode
npm run dev

# Run tests with coverage
npm run test:coverage

# Lint code
npm run lint
```

## 📊 Project Status

- ✅ **Production Ready**: v0.9.0 with comprehensive test coverage
- 🚧 **Coming Soon**: Node.js debugging, multi-language support
- 📈 **Active Development**: Regular updates and improvements

## 📄 License

MIT License - see [LICENSE](./LICENSE) for details.

## 🙏 Acknowledgments

Built with:
- [Model Context Protocol](https://github.com/anthropics/model-context-protocol) by Anthropic
- [Debug Adapter Protocol](https://microsoft.github.io/debug-adapter-protocol/) by Microsoft
- [debugpy](https://github.com/microsoft/debugpy) for Python debugging

## 📧 Contact

- **Issues**: [GitHub Issues](https://github.com/debugmcp/mcp-debugger/issues)
- **Email**: debug@sycamore.llc
- **Discussions**: [GitHub Discussions](https://github.com/debugmcp/mcp-debugger/discussions)

---

**Give your AI the power to debug like a developer!** 🎯
