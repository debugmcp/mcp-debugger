# Getting Started with Debug MCP Server

This guide will walk you through testing the Debug MCP Server locally with a simple Python example.

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

The server outputs logs to the terminal where you launched it. These logs can provide valuable debugging information:

- Check for any "error" level logs
- Look for messages about Python detection and debugpy availability
- Monitor DAP (Debug Adapter Protocol) communication logs

## Next Steps

Once you've verified the server works with the example, you can try:

1. Debugging your own Python scripts
2. Exploring more complex debugging scenarios
3. Testing the source code viewing and variable inspection features

For more details on available commands, see the [Python Debugging documentation](./python/README.md).
