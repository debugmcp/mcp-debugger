# Using the mcp-debugger

This document describes how to use the mcp-debugger with Large Language Models (LLMs) for step-through debugging, based on real testing conducted on 2025-06-11.

## Installation

### Prerequisites

- Node.js 16+ 
- Python 3.7+ with debugpy (for Python debugging)

### Installing from NPM

```bash
npm install -g mcp-debugger
```

### Building from Source

```bash
git clone https://github.com/debugmcp/mcp-debugger.git
cd mcp-debugger
npm install
npm run build
```

## Configuration

### MCP Client Configuration

Add the server to your MCP settings:

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

## Complete Debugging Workflow Example

Here's a real example of debugging a Python script with a bug:

### The Buggy Script

```python
# swap_vars.py
def swap_variables(a, b):
    print(f"Initial values: a = {a}, b = {b}")
    a = b  # Bug: 'a' loses its original value here
    b = a  # Bug: 'b' gets the new value of 'a' (which is original 'b')
    print(f"Swapped values: a = {a}, b = {b}")
    return a, b

def main():
    x = 10
    y = 20
    print("Starting variable swap demo...")
    swapped_x, swapped_y = swap_variables(x, y)
    
    if swapped_x == 20 and swapped_y == 10:
        print("Swap successful!")
    else:
        print(f"Swap NOT successful. Expected x=20, y=10 but got x={swapped_x}, y={swapped_y}")

if __name__ == "__main__":
    main()
```

### Step 1: Create a Debug Session

```json
// Tool: create_debug_session
// Request:
{
  "language": "python",
  "name": "Investigate Swap Bug"
}
// Response:
{
  "success": true,
  "sessionId": "a4d1acc8-84a8-44fe-a13e-28628c5b33c7",
  "message": "Created python debug session: Investigate Swap Bug"
}
```

### Step 2: Set Breakpoints

Set a breakpoint where the bug occurs:

```json
// Tool: set_breakpoint
// Request:
{
  "sessionId": "a4d1acc8-84a8-44fe-a13e-28628c5b33c7",
  "file": "swap_vars.py",
  "line": 4
}
// Response:
{
  "success": true,
  "breakpointId": "28e06119-619e-43c0-b029-339cec2615df",
  "file": "C:\\path\\to\\swap_vars.py",
  "line": 4,
  "verified": false,
  "message": "Breakpoint set at C:\\path\\to\\swap_vars.py:4"
}
```

### Step 3: Start Debugging

```json
// Tool: start_debugging
// Request:
{
  "sessionId": "a4d1acc8-84a8-44fe-a13e-28628c5b33c7",
  "scriptPath": "swap_vars.py"
}
// Response:
{
  "success": true,
  "state": "paused",
  "message": "Debugging started for swap_vars.py. Current state: paused",
  "data": {
    "message": "Debugging started for swap_vars.py. Current state: paused",
    "reason": "breakpoint"
  }
}
```

### Step 4: Inspect the Stack

```json
// Tool: get_stack_trace
// Request:
{
  "sessionId": "a4d1acc8-84a8-44fe-a13e-28628c5b33c7"
}
// Response:
{
  "success": true,
  "stackFrames": [
    {
      "id": 3,
      "name": "swap_variables",
      "file": "C:\\path\\to\\swap_vars.py",
      "line": 4,
      "column": 1
    },
    {
      "id": 4,
      "name": "main",
      "file": "C:\\path\\to\\swap_vars.py",
      "line": 13,
      "column": 1
    },
    {
      "id": 2,
      "name": "<module>",
      "file": "C:\\path\\to\\swap_vars.py",
      "line": 21,
      "column": 1
    }
  ],
  "count": 3
}
```

### Step 5: Get Variable Scopes

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

### Step 6: Inspect Variables Before the Bug

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

### Step 7: Step Through the Bug

```json
// Tool: step_over
// Request:
{
  "sessionId": "a4d1acc8-84a8-44fe-a13e-28628c5b33c7"
}
// Response:
{
  "success": true,
  "state": "paused",
  "message": "Stepped over"
}
```

### Step 8: Check Variables After First Assignment

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
    {"name": "a", "value": "20", "type": "int", "variablesReference": 0, "expandable": false},
    {"name": "b", "value": "20", "type": "int", "variablesReference": 0, "expandable": false}
  ],
  "count": 2,
  "variablesReference": 5
}
```

Now we can see the bug! After `a = b`, both variables have the value 20.

### Step 8b: Evaluate Expressions (Optional)

You can also evaluate arbitrary expressions in the current debug context:

```json
// Tool: evaluate_expression
// Request:
{
  "sessionId": "a4d1acc8-84a8-44fe-a13e-28628c5b33c7",
  "expression": "a == b"
}
// Response:
{
  "success": true,
  "result": "True",
  "type": "bool",
  "variablesReference": 0,
  "message": "Evaluated expression: a == b"
}
```

### Step 9: Continue Execution

```json
// Tool: continue_execution
// Request:
{
  "sessionId": "a4d1acc8-84a8-44fe-a13e-28628c5b33c7"
}
// Response:
{
  "success": true,
  "state": "running",
  "message": "Continued execution"
}
```

### Step 10: Close the Session

```json
// Tool: close_debug_session
// Request:
{
  "sessionId": "a4d1acc8-84a8-44fe-a13e-28628c5b33c7"
}
// Response:
{
  "success": true,
  "message": "Closed debug session: a4d1acc8-84a8-44fe-a13e-28628c5b33c7"
}
```

## Important Implementation Details

### Session IDs
- All session IDs are UUIDs in the format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
- Sessions can terminate unexpectedly, always check if a session exists before operations

### Variable Scope References
- The `variablesReference` from `get_scopes` is what you pass to `get_variables`
- This is NOT the same as the frame ID from `get_stack_trace`
- Common mistake: Using frame ID instead of variablesReference

### Breakpoint Behavior
- Breakpoints always show `"verified": false` until debugging starts
- Avoid setting breakpoints on non-executable lines (comments, blank lines)
- Best lines for breakpoints: assignments, function calls, conditionals

### File Paths
- The server converts relative paths to absolute paths
- Responses always include the full absolute path
- Use forward slashes (/) or escaped backslashes (\\\\) in JSON

## Common Errors and Solutions

### "Managed session not found"
```json
{
  "code": -32603,
  "message": "MCP error -32603: Failed to continue execution: Managed session not found: {sessionId}"
}
```
**Solution**: The session has terminated. Create a new session.

### Invalid Scope Reference
```json
{
  "code": -32602,
  "message": "scope (variablesReference) parameter is required and must be a number"
}
```
**Solution**: Use the `variablesReference` from `get_scopes`, not the frame ID.

## Unimplemented Features

The following tools are defined but not yet implemented:

1. **pause_execution**: Returns "Pause execution not yet implemented with proxy"
2. **get_source_context**: Returns "Get source context not yet fully implemented with proxy"

See [Roadmap.md](../Roadmap.md) for implementation timeline.

## Recently Implemented Features (v0.13.0)

### evaluate_expression
The `evaluate_expression` tool is now fully functional, allowing you to:
- Evaluate arbitrary expressions in the current debug context
- Automatically uses the current frame when `frameId` is not specified
- Modify program state (expressions with side effects are allowed)
- Get detailed type information and variablesReference for complex objects

Example usage:
```json
// Tool: evaluate_expression
// Request:
{
  "sessionId": "your-session-id",
  "expression": "len([1, 2, 3]) * 2"
}
// Response:
{
  "success": true,
  "result": "6",
  "type": "int",
  "variablesReference": 0,
  "message": "Evaluated expression: len([1, 2, 3]) * 2"
}
```

## Best Practices

1. **Always create a session first** - No debugging operations work without an active session
2. **Check the stack trace** - Understand where you are in the code before inspecting variables
3. **Get scopes before variables** - You need the variablesReference to inspect variables
4. **Handle errors gracefully** - Sessions can terminate, files might not exist
5. **Use meaningful session names** - Helps when debugging multiple scripts

---

*Last updated: 2025-09-11 - Updated with evaluate_expression implementation (v0.13.0)*
