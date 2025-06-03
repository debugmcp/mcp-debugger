# MCP Debugger

`mcp-debugger` enables run-time step-through debugging for LLM agents, allowing them to interactively find and fix bugs in code. It's a Model Context Protocol (MCP) server that empowers LLMs by giving them tools to set breakpoints, step through execution, inspect variables, and more.

[![Node.js CI & Lint](https://github.com/your-username/debug-mcp-server/actions/workflows/ci.yml/badge.svg)](https://github.com/your-username/debug-mcp-server/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
<!-- [![Docker Pulls](https://img.shields.io/docker/pulls/your-dockerhub/debug-mcp-server.svg)](https://hub.docker.com/r/your-dockerhub/debug-mcp-server) -->
<!-- Removed PyPI version badge for launcher for now, focusing on core badges -->

## Demo

**(Coming Soon: Asciinema demo showcasing an LLM debugging a Python script using `mcp-debugger`!)**

## Quick Start

There are two primary ways to get started with `mcp-debugger`:

1.  **Using the Python Launcher (Recommended for Python users):**
    ```bash
    pip install mcp-debugger-launcher
    mcp-debugger # This will attempt to run the server via Docker by default
    # Or, to run a local Node.js build (if available): mcp-debugger --host 6111
    ```

2.  **Using Docker Directly:**
    ```bash
    # For STDIN/STDOUT communication (common for local agent frameworks)
    docker run -i --rm -v "$(pwd):/workspace" -w /workspace your-dockerhub/debug-mcp-server:stdio
    
    # For TCP communication (e.g., remote client or specific agent setups)
    docker run -d -p 6111:6111 -v "$(pwd):/workspace" -w /workspace your-dockerhub/debug-mcp-server:tcp
    ```

See "Usage with LLMs" below for how to configure your LLM agent or MCP client to connect.

## Features

- **Step-through debugging** - Set breakpoints, step over/into/out, and continue execution
- **Variable inspection** - View variable values at any point in execution
- **Call stack navigation** - Understand the execution path of your code
- **Expression evaluation** - Evaluate expressions in the current debug context
- **Source code viewing** - View source code with context around the current position
- **Cross-platform support** - Works on Windows, macOS, and Linux
- **Auto-detection** - Automatically finds Python installations and debugpy
- **Session management** - Create and manage multiple debugging sessions
- **LLM-optimized output** - Results formatted for easy consumption by LLMs

## Prerequisites

The prerequisites depend on how you plan to use `mcp-debugger`:

**1. Using Docker (via Launcher or Directly):**
   - **Docker:** Must be installed and running on your system. This is the primary prerequisite for the recommended Quick Start methods.

**2. Using the `mcp-debugger-launcher` Python package:**
   - **Python:** To install and run the `mcp-debugger-launcher` package itself.
   - **Docker:** As the launcher defaults to using Docker to run the `mcp-debugger` server.
   - *(Optional)* If you use the launcher's `--host` option to run a local Node.js build of the server (instead of Docker), you would also need:
     - **Node.js:** Version 16.0.0 or higher installed on your system.

**3. Building from Source / Running a Local Node.js Build Directly:**
   - **Node.js:** Version 16.0.0 or higher (for building and running the server JavaScript code).
   - **For the Python code you intend to debug** (using this locally built server):
     - **Python:** Version 3.7 or higher.
     - **`debugpy` package:** The `mcp-debugger` server will attempt to manage `debugpy` within the target Python environment. If running the server outside Docker, ensure the target Python environment can have `debugpy` installed or made available to it. (The Docker image includes `debugpy`).

## Building from Source (For Developers)

If you want to build the server from source:

```bash
# Install dependencies 
npm install

# Build the project (outputs to dist/)
npm run build
```
The server can then be run directly using Node.js:
```bash
node dist/index.js # For STDIN/STDOUT
node dist/index.js --transport tcp --port 6111 # For TCP
```
(See `CONTRIBUTING.md` for more details on development and testing.)

## Usage with LLMs

### Adding to your LLM Agent / MCP Client

Add the server to your MCP settings file (e.g., `mcp_settings.json` for Claude Desktop or similar clients). The exact command depends on how you run the server:

1.  **If using `mcp-debugger-launcher` (Recommended):**
    The launcher should be in your PATH after `pip install`.
    ```json
    {
      "mcpServers": {
        "mcp-debugger": {
          "command": "mcp-debugger", // Assumes launcher handles Docker/Node
          "disabled": false,
          "autoApprove": [] // Add specific tools if desired
        }
      }
    }
    ```
    If the launcher runs the server in TCP mode (e.g., `mcp-debugger --host 6111`), you'll need to configure your MCP client to connect via TCP, which is not shown here as it's client-specific. Most direct integrations will use STDIN/STDOUT.

2.  **If running Docker directly (STDIO mode):**
    Your agent framework needs to manage the Docker container and pipe STDIN/STDOUT. Configuration is specific to the agent.

3.  **If running Docker directly (TCP mode on port 6111):**
    ```json
    {
      "mcpServers": {
        "debug-mcp-server-tcp": { // Different name to distinguish
          "transport": "tcp",
          "host": "localhost",
          "port": 6111,
          "disabled": false,
          "autoApprove": []
        }
      }
    }
    ```
    *Ensure the Docker container `your-dockerhub/debug-mcp-server:tcp` is running and port 6111 is mapped.*

4.  **If running Node.js build directly (STDIO mode):**
    ```json
    {
      "mcpServers": {
        "mcp-debugger-local-stdio": {
          "command": "node",
          "args": ["/path/to/your/mcp-debugger/dist/index.js"],
          "disabled": false,
          "autoApprove": []
        }
      }
    }
    ```

5.  **If running Node.js build directly (TCP mode on port 6111):**
    ```json
    {
      "mcpServers": {
        "mcp-debugger-local-tcp": {
          "command": "node",
          "args": ["/path/to/your/mcp-debugger/dist/index.js", "--transport", "tcp", "--port", "6111"],
          // Or, if using the TCP transport directly in settings:
          // "transport": "tcp",
          // "host": "localhost",
          // "port": 6111, 
          // "startupCommand": "node /path/to/your/mcp-debugger/dist/index.js --transport tcp --port 6111",
          "disabled": false,
          "autoApprove": []
        }
      }
    }
    ```
    *Note: TCP configuration in `mcp_settings.json` can vary. The example above shows starting it as a command. If your client supports direct TCP connection without a command, use its specific format.*

### Python Auto-Detection

The server will:
1. Try to find Python installations on your system automatically
2. Check if debugpy is available and install it if missing
3. Fall back to environment variable `PYTHON_PATH` if specified

You can also provide a specific Python path in the debug session configuration.

### Example Prompts for Claude

- "Debug my Python script and set a breakpoint at line 42"
- "Step through this function and show me the value of variable 'data' at each step"
- "Show me all variable values when execution reaches the for loop"
- "Evaluate the expression 'result + 10' in the current context"

<!-- Testing information will be moved to CONTRIBUTING.md -->

## Documentation

See the [docs](./docs) directory for detailed documentation:

- [Getting Started Guide](./docs/getting-started.md) - Step-by-step tutorial for first-time setup
- [Python Debugging](./docs/python/README.md) - Python-specific debugging instructions
- [Multiple MCP Servers](./docs/multiple-mcp-servers.md) - Using Debug MCP with GitHub MCP Server
- [Docker Support](./docs/docker-support.md) - Running with Docker containers
- [Windows Launcher Guide](./docs/windows-launcher-guide.md) - Working with launcher scripts on Windows
- [Troubleshooting Guide](./docs/troubleshooting.md) - Solutions for common issues
- [Usage Guide](./docs/usage.md) - General usage information
- [Examples](./examples/README.md) - Example scripts to try debugging

## Troubleshooting

### Python Issues
- If Python auto-detection fails, set the `PYTHON_PATH` environment variable to your Python executable path
- If debugpy installation fails, install it manually with: `pip install debugpy`
- Ensure Python is in your PATH environment variable

### Connectivity Issues
- Check that the Debug MCP Server is running in your task manager
- Verify your MCP settings JSON syntax
- Ensure proper path escaping if your installation path contains spaces

### Getting Help
If you encounter issues, check:
- The server logs in the terminal
- VS Code output panel (if using VS Code)

## License

This project is licensed under the MIT License - see the LICENSE file for details.
