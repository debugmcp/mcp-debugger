# Quickstart: mcp-debugger

This guide will help you get started with `mcp-debugger` quickly, using real examples from testing conducted on 2025-06-11.

## Prerequisites

- **Node.js** (v16+) and npm installed
- **Python** (3.8+) with `debugpy` installed
- **MCP Client** (Claude Desktop, or custom implementation)

## Installation

### Option 1: Using npm (when published)

```bash
npm install -g mcp-debugger
```

### Option 2: From Source

```bash
git clone https://github.com/debugmcp/mcp-debugger.git
cd mcp-debugger
npm install
npm run build
```

## Running the Server

### For MCP Clients (Recommended)

Add to your MCP client configuration (e.g., Claude Desktop):

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

### Command Line Options

```bash
# Run with debugging output
node dist/index.js --log-level debug --log-file ./logs/debug.log

# Run in quiet mode
node dist/index.js --log-level error
```

## Quick Example: Debug a Python Script

Let's debug a simple Python script with a bug:

### 1. Create a Test Script

Save this as `buggy_math.py`:

```python
def calculate_average(numbers):
    total = 0
    for num in numbers:
        total += num
    # Bug: dividing by wrong value
    average = total / len(numbers) + 1  
    return average

numbers = [10, 20, 30, 40, 50]
result = calculate_average(numbers)
print(f"Average: {result}")
```

### 2. Start a Debug Session

```json
// Tool: create_debug_session
{
  "language": "python",
  "name": "Debug Math Bug"
}
// Response:
{
  "success": true,
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Created python debug session: Debug Math Bug"
}
```

### 3. Set a Breakpoint

```json
// Tool: set_breakpoint
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "file": "buggy_math.py",
  "line": 6
}
// Response:
{
  "success": true,
  "breakpointId": "bp-123456",
  "file": "C:\\path\\to\\buggy_math.py",
  "line": 6,
  "verified": false,
  "message": "Breakpoint set at C:\\path\\to\\buggy_math.py:6"
}
```

### 4. Start Debugging

```json
// Tool: start_debugging
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "scriptPath": "buggy_math.py"
}
// Response:
{
  "success": true,
  "state": "paused",
  "message": "Debugging started for buggy_math.py. Current state: paused",
  "data": {
    "message": "Debugging started for buggy_math.py. Current state: paused",
    "reason": "breakpoint"
  }
}
```

### 5. Inspect Variables

First, get the stack trace:

```json
// Tool: get_stack_trace
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000"
}
// Response shows we're in calculate_average function
```

Then get scopes:

```json
// Tool: get_scopes
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "frameId": 1
}
// Response:
{
  "success": true,
  "scopes": [
    {
      "name": "Locals",
      "variablesReference": 3,
      "expensive": false,
      "presentationHint": "locals"
    }
  ]
}
```

Finally, inspect the variables:

```json
// Tool: get_variables
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "scope": 3
}
// Response:
{
  "success": true,
  "variables": [
    {"name": "numbers", "value": "[10, 20, 30, 40, 50]", "type": "list"},
    {"name": "total", "value": "150", "type": "int"},
    {"name": "average", "value": "31.0", "type": "float"}
  ]
}
```

### 6. Clean Up

```json
// Tool: close_debug_session
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000"
}
// Response:
{
  "success": true,
  "message": "Closed debug session: 550e8400-e29b-41d4-a716-446655440000"
}
```

## Key Points to Remember

1. **Session IDs are UUIDs** - Always save the sessionId from create_debug_session
2. **Get scopes before variables** - You need the variablesReference, not the frame ID
3. **Breakpoints need executable lines** - Avoid comments and blank lines
4. **Sessions can terminate** - Handle errors gracefully

## What's Next?

- Read the [Tool Reference](./tool-reference.md) for complete API documentation
- See [Usage Guide](./usage.md) for more complex debugging scenarios
- Check [Troubleshooting](./troubleshooting.md) if you encounter issues

## Troubleshooting Quick Tips

### MCP Server Not Found
- Ensure the path in your MCP config is absolute
- Check that the server was built (`npm run build`)
- Verify Node.js is in your PATH

### Python Debugging Not Working
- Install debugpy: `pip install debugpy`
- Ensure Python is in your PATH
- Use absolute paths for script files

### Session Terminated Unexpectedly
- Check the log file for errors
- Ensure the Python script exists
- Verify breakpoints are on executable lines

---

*For more detailed information, see the full [documentation](./README.md).*
