# Getting Started with Debug MCP Server

This guide will walk you through testing the Debug MCP Server locally with a simple Python example. The server also supports JavaScript, Rust, Go, Java, and .NET/C# debugging -- see the language-specific guides for details.

## Prerequisites

1. Make sure you've completed installation:
   ```
   pnpm install
   npm run build
   ```

2. Check that Python and debugpy are installed:
   ```
   python --version
   pip list | grep debugpy
   ```

3. Verify the MCP settings are configured properly in VS Code

## Step-by-Step Testing

### 1. Start Claude VS Code Extension

Open VS Code and ensure the Claude extension is running and connected.

### 2. Test the Example Python Script

The repository includes a simple Fibonacci calculator in `examples/python/fibonacci.py`. Let's debug this file.

#### Using Claude to Debug

In a new conversation with Claude, try these prompts:

1. **Create a debug session**:
   ```
   Create a new Python debug session named "Fibonacci Test"
   ```

2. **Set a breakpoint**:
   ```
   Set a breakpoint in examples/python/fibonacci.py at line 21
   ```
   (Line 21 is inside the `fibonacci_iterative` function)

3. **Start debugging**:
   ```
   Start debugging examples/python/fibonacci.py
   ```

4. **Step through the code**:
   ```
   Step over the current line
   ```
   Or
   ```
   Step into the function call
   ```

5. **Inspect variables**:
   ```
   Show me all the variables in the current scope
   ```

6. **Evaluate an expression**:
   ```
   Evaluate n + 1 in the current context
   ```

7. **Continue execution**:
   ```
   Continue execution to the next breakpoint
   ```

8. **Close the session when finished**:
   ```
   Close the debug session
   ```

## Checking Server Status

If you encounter issues, you can check the server status in VS Code:

1. Click on the Claude extension icon in the VS Code sidebar
2. Look for the "debug-mcp-server" entry in the MCP Servers list
3. Check if it shows as "Connected" or if there are any error messages

## Understanding the Server Logs

The server suppresses all console output in **all transport modes** (stdio, SSE, etc.) to avoid corrupting the JSON-RPC protocol stream. Logs are only written when a `--log-file` path is specified. To inspect logs:

1. Configure a log file in your MCP settings: `"args": ["dist/index.js", "stdio", "--log-file", "/path/to/debug.log"]`
2. Check the log file for "error" level entries
3. Look for messages about Python detection and debugpy availability
4. Monitor DAP (Debug Adapter Protocol) communication logs

## Next Steps

Once you've verified the server works with the example, you can try:

1. Debugging your own Python scripts
2. Exploring more complex debugging scenarios
3. Testing the source code viewing and variable inspection features

For more details on available commands, see the [Usage Guide](./usage.md).
