# mcp-debugger Tool Reference

This document provides a complete reference for all tools available in mcp-debugger, based on real testing conducted on 2025-06-11.

## Table of Contents

1. [Session Management](#session-management)
   - [create_debug_session](#create_debug_session)
   - [list_debug_sessions](#list_debug_sessions)
   - [close_debug_session](#close_debug_session)
2. [Breakpoint Management](#breakpoint-management)
   - [set_breakpoint](#set_breakpoint)
3. [Execution Control](#execution-control)
   - [start_debugging](#start_debugging)
   - [step_over](#step_over)
   - [step_into](#step_into)
   - [step_out](#step_out)
   - [continue_execution](#continue_execution)
   - [pause_execution](#pause_execution) *(Not Implemented)*
4. [State Inspection](#state-inspection)
   - [get_stack_trace](#get_stack_trace)
   - [get_scopes](#get_scopes)
   - [get_variables](#get_variables)
   - [evaluate_expression](#evaluate_expression) *(Not Implemented)*
   - [get_source_context](#get_source_context)

---

## Session Management

### create_debug_session

Creates a new debugging session.

**Parameters:**
- `language` (string, required): The programming language to debug. Currently only `"python"` is supported.
- `name` (string, optional): A descriptive name for the debug session. Defaults to `"Debug-{timestamp}"`.
- `executablePath` (string, optional): Path to the language interpreter/executable (e.g., Python interpreter path).
- `host` (string, optional): Host for remote debugging *(not implemented)*.
- `port` (number, optional): Port for remote debugging *(not implemented)*.

**Response:**
```json
{
  "success": true,
  "sessionId": "a4d1acc8-84a8-44fe-a13e-28628c5b33c7",
  "message": "Created python debug session: Test Debug Session"
}
```

**Example:**
```json
{
  "language": "python",
  "name": "My Debug Session"
}
```

**Notes:**
- Session IDs are UUIDs in the format `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
- Sessions start in `"created"` state

---

### list_debug_sessions

Lists all active debugging sessions.

**Parameters:** None (empty object `{}`)

**Response:**
```json
{
  "success": true,
  "sessions": [
    {
      "id": "a4d1acc8-84a8-44fe-a13e-28628c5b33c7",
      "name": "Test Debug Session",
      "language": "python",
      "state": "created",
      "createdAt": "2025-06-11T04:53:14.762Z",
      "updatedAt": "2025-06-11T04:53:14.762Z"
    }
  ],
  "count": 1
}
```

**Session States:**
- `"created"`: Session created but not started
- `"running"`: Actively debugging
- `"paused"`: Paused at breakpoint or step

---

### close_debug_session

Closes an active debugging session.

**Parameters:**
- `sessionId` (string, required): The ID of the debug session to close.

**Response:**
```json
{
  "success": true,
  "message": "Closed debug session: a4d1acc8-84a8-44fe-a13e-28628c5b33c7"
}
```

**Notes:**
- Sessions may close automatically on errors
- Closing a non-existent session returns `success: false`

---

## Breakpoint Management

### set_breakpoint

Sets a breakpoint in a source file.

**Parameters:**
- `sessionId` (string, required): The ID of the debug session.
- `file` (string, required): Path to the source file (absolute or relative to project root).
- `line` (number, required): Line number where to set breakpoint (1-indexed).
- `condition` (string, optional): Conditional expression for the breakpoint *(not verified to work)*.

**Response:**
```json
{
  "success": true,
  "breakpointId": "28e06119-619e-43c0-b029-339cec2615df",
  "file": "C:\\path\\to\\debug-mcp-server\\examples\\python_simple_swap\\swap_vars.py",
  "line": 9,
  "verified": false,
  "message": "Breakpoint set at C:\\path\\to\\debug-mcp-server\\examples\\python_simple_swap\\swap_vars.py:9",
  "context": {
    "lineContent": "    a = b  # Bug: loses original value of 'a'",
    "surrounding": [
      { "line": 7, "content": "def swap_variables(a, b):" },
      { "line": 8, "content": "    \"\"\"This function is supposed to swap two variables.\"\"\"" },
      { "line": 9, "content": "    a = b  # Bug: loses original value of 'a'" },
      { "line": 10, "content": "    b = a  # Bug: 'b' gets the new value of 'a', not the original" },
      { "line": 11, "content": "    return a, b" }
    ]
  }
}
```

**Important Notes:**
- Breakpoints show `"verified": false` until debugging starts
- The response includes the absolute path even if you provide a relative path
- Setting breakpoints on non-executable lines (comments, blank lines, declarations) may cause unexpected behavior
- Executable lines that work well: assignments, function calls, conditionals, returns

---

## Execution Control

### start_debugging

Starts debugging a script.

**Parameters:**
- `sessionId` (string, required): The ID of the debug session.
- `scriptPath` (string, required): Path to the script to debug.
- `args` (array of strings, optional): Command line arguments for the script.
- `dapLaunchArgs` (object, optional): Additional DAP launch arguments:
  - `stopOnEntry` (boolean): Stop at first line
  - `justMyCode` (boolean): Debug only user code
- `dryRunSpawn` (boolean, optional): Test spawn without actually starting

**Response:**
```json
{
  "success": true,
  "state": "paused",
  "message": "Debugging started for examples/python_simple_swap/swap_vars.py. Current state: paused",
  "data": {
    "message": "Debugging started for examples/python_simple_swap/swap_vars.py. Current state: paused",
    "reason": "breakpoint"
  }
}
```

**Pause Reasons:**
- `"breakpoint"`: Stopped at a breakpoint
- `"step"`: Stopped after a step operation
- `"entry"`: Stopped on entry (if configured)

---

### step_over

Steps over the current line, executing it without entering function calls.

**Parameters:**
- `sessionId` (string, required): The ID of the debug session.

**Response:**
```json
{
  "success": true,
  "state": "paused",
  "message": "Stepped over"
}
```

---

### step_into

Steps into function calls on the current line.

**Parameters:**
- `sessionId` (string, required): The ID of the debug session.

**Response:**
```json
{
  "success": true,
  "state": "paused",
  "message": "Stepped into"
}
```

---

### step_out

Steps out of the current function.

**Parameters:**
- `sessionId` (string, required): The ID of the debug session.

**Response:**
```json
{
  "success": true,
  "state": "paused",
  "message": "Stepped out"
}
```

---

### continue_execution

Continues execution until the next breakpoint or program end.

**Parameters:**
- `sessionId` (string, required): The ID of the debug session.

**Response:**
```json
{
  "success": true,
  "state": "running",
  "message": "Continued execution"
}
```

**Error Response:**
```json
{
  "code": -32603,
  "message": "MCP error -32603: Failed to continue execution: Managed session not found: {sessionId}"
}
```

---

### pause_execution ❌

**Status:** Not Implemented

**Parameters:**
- `sessionId` (string, required): The ID of the debug session.

**Error Response:**
```json
{
  "code": -32603,
  "message": "MCP error -32603: Pause execution not yet implemented with proxy."
}
```

---

## State Inspection

### get_stack_trace

Gets the current call stack.

**Parameters:**
- `sessionId` (string, required): The ID of the debug session.

**Response:**
```json
{
  "success": true,
  "stackFrames": [
    {
      "id": 3,
      "name": "swap_variables",
      "file": "C:\\path\\to\\debug-mcp-server\\examples\\python_simple_swap\\swap_vars.py",
      "line": 5,
      "column": 1
    },
    {
      "id": 4,
      "name": "main",
      "file": "C:\\path\\to\\debug-mcp-server\\examples\\python_simple_swap\\swap_vars.py",
      "line": 21,
      "column": 1
    },
    {
      "id": 2,
      "name": "<module>",
      "file": "C:\\path\\to\\debug-mcp-server\\examples\\python_simple_swap\\swap_vars.py",
      "line": 30,
      "column": 1
    }
  ],
  "count": 3
}
```

**Notes:**
- Stack frames are ordered from innermost (current) to outermost
- Frame IDs are used with `get_scopes`

---

### get_scopes

Gets variable scopes for a specific stack frame.

**Parameters:**
- `sessionId` (string, required): The ID of the debug session.
- `frameId` (number, required): The ID of the stack frame from `get_stack_trace`.

**Response:**
```json
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

**Important:**
- The `variablesReference` is what you pass to `get_variables` as the `scope` parameter
- This is NOT the same as the frame ID!

---

### get_variables

Gets variables within a scope.

**Parameters:**
- `sessionId` (string, required): The ID of the debug session.
- `scope` (number, required): The `variablesReference` number from a scope or variable.

**Response:**
```json
{
  "success": true,
  "variables": [
    {
      "name": "a",
      "value": "10",
      "type": "int",
      "variablesReference": 0,
      "expandable": false
    },
    {
      "name": "b",
      "value": "20",
      "type": "int",
      "variablesReference": 0,
      "expandable": false
    }
  ],
  "count": 2,
  "variablesReference": 5
}
```

**Variable Properties:**
- `variablesReference`: 0 for primitive types, >0 for complex objects that can be expanded
- `expandable`: Whether the variable has child properties
- Values are always returned as strings

---

### evaluate_expression

Evaluates an expression in the context of the current debug session.

**Parameters:**
- `sessionId` (string, required): The ID of the debug session.
- `expression` (string, required): The expression to evaluate.
- `frameId` (number, optional): Stack frame ID for context. If not provided, automatically uses the current (top) frame.

**Response:**
```json
{
  "success": true,
  "result": "10",
  "type": "int",
  "variablesReference": 0,
  "presentationHint": {}
}
```

**Example - Simple Variable:**
```json
// Request (no frameId needed!)
{
  "sessionId": "d507d6fb-45fc-4295-9dc0-4f44b423c103",
  "expression": "x"
}

// Response
{
  "success": true,
  "result": "10",
  "type": "int",
  "variablesReference": 0
}
```

**Example - Arithmetic Expression:**
```json
// Request
{
  "sessionId": "d507d6fb-45fc-4295-9dc0-4f44b423c103",
  "expression": "x + y"
}

// Response
{
  "success": true,
  "result": "30",
  "type": "int",
  "variablesReference": 0
}
```

**Example - Complex Expression:**
```json
// Request
{
  "sessionId": "d507d6fb-45fc-4295-9dc0-4f44b423c103",
  "expression": "[i*2 for i in range(5)]"
}

// Response
{
  "success": true,
  "result": "[0, 2, 4, 6, 8]",
  "type": "list",
  "variablesReference": 4  // Can be expanded to see elements
}
```

**Error Handling:**
```json
// Request - undefined variable
{
  "sessionId": "d507d6fb-45fc-4295-9dc0-4f44b423c103",
  "expression": "undefined_variable"
}

// Response
{
  "success": false,
  "error": "Name not found: Traceback (most recent call last):\n  File \"<string>\", line 1, in <module>\nNameError: name 'undefined_variable' is not defined\n"
}
```

**Important Notes:**
- **Automatic Frame Detection**: When `frameId` is not provided, the tool automatically gets the current frame from the stack trace
- **Side Effects Are Allowed**: Expressions CAN modify program state (e.g., `x = 100`). This is intentional and useful for debugging
- **Session Must Be Paused**: The debugger must be stopped at a breakpoint for evaluation to work
- **Results Are Strings**: All results are returned as strings, even for numeric types
- **Python Truncation**: Python/debugpy automatically truncates collections at 300 items for performance

---

### get_source_context

Gets source code context around a specific line in a file.

**Parameters:**
- `sessionId` (string, required): The ID of the debug session.
- `file` (string, required): Path to the source file (absolute or relative to project root).
- `line` (number, required): Line number to get context for (1-indexed).
- `linesContext` (number, optional): Number of lines before and after to include (default: 5).

**Response:**
```json
{
  "success": true,
  "file": "C:\\path\\to\\script.py",
  "line": 15,
  "lineContent": "    result = calculate_sum(x, y)",
  "surrounding": [
    { "line": 12, "content": "def main():" },
    { "line": 13, "content": "    x = 10" },
    { "line": 14, "content": "    y = 20" },
    { "line": 15, "content": "    result = calculate_sum(x, y)" },
    { "line": 16, "content": "    print(f\"Result: {result}\")" },
    { "line": 17, "content": "    return result" },
    { "line": 18, "content": "" }
  ],
  "contextLines": 3
}
```

**Example:**
```json
{
  "sessionId": "a4d1acc8-84a8-44fe-a13e-28628c5b33c7",
  "file": "test_script.py",
  "line": 25,
  "linesContext": 3
}
```

**Notes:**
- Useful for AI agents to understand code structure without reading entire files
- Returns the requested line content and surrounding context
- Handles file boundaries gracefully (won't return lines before 1 or after EOF)
- Uses efficient line reading with LRU caching for performance

---

## Error Handling

All tools follow consistent error patterns:

### Common Error Codes
- `-32603`: Internal error (feature not implemented, session not found, etc.)
- `-32602`: Invalid parameters

### Error Response Format
```json
{
  "code": -32603,
  "name": "McpError",
  "message": "MCP error -32603: {specific error message}",
  "stack": "{stack trace}"
}
```

### Common Error Scenarios
1. **Session not found**: Occurs when a session terminates unexpectedly
2. **Invalid language**: Only "python" is currently supported
3. **File not found**: When setting breakpoints in non-existent files
4. **Invalid scope**: When passing wrong variablesReference to get_variables

---

## Best Practices

1. **Always check session state** before performing operations
2. **Use absolute paths** for files to avoid ambiguity
3. **Get scopes before variables** - you need the variablesReference
4. **Handle session termination** gracefully - sessions can end unexpectedly
5. **Set breakpoints on executable lines** - avoid comments and declarations

---

*Last updated: 2025-07-28 based on actual testing with mcp-debugger v0.12.0*
