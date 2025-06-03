# Using the Debug MCP Server

This document describes how to use the Debug MCP Server with Large Language Models (LLMs) for step-through debugging.

## Installation

### Prerequisites

- Node.js 16+ 
- Python 3.7+ with debugpy (for Python debugging)

### Installing from NPM

```bash
npm install -g debug-mcp-server
```

### Building from Source

```bash
git clone https://github.com/yourusername/debug-mcp-server.git
cd debug-mcp-server
npm install
npm run build
```

## Configuration

### VS Code Plugin Configuration

Add the server to your MCP settings in VS Code:

```json
{
  "mcpServers": {
    "debug": {
      "command": "debug-mcp-server",
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

## Available Tools

The Debug MCP Server provides the following tools:

### create_debug_session

Create a new debugging session.

**Parameters**:
- `language` (required): The programming language to debug (currently only `python` is supported)
- `name` (optional): A name for the debug session

**Example**:
```json
{
  "language": "python",
  "name": "My Debug Session"
}
```

**Returns**:
```json
{
  "success": true,
  "sessionId": "session-uuid",
  "message": "Created python debug session: My Debug Session"
}
```

### list_debug_sessions

Lists all active debugging sessions.

**Parameters**: None

**Returns**:
```json
{
  "success": true,
  "sessions": [
    {
      "id": "session-uuid",
      "name": "My Debug Session",
      "language": "python",
      "state": "ready",
      "createdAt": "2025-04-30T12:30:00.000Z",
      "updatedAt": "2025-04-30T12:30:00.000Z"
    }
  ],
  "count": 1
}
```

### set_breakpoint

Set a breakpoint in a debugging session.

**Parameters**:
- `sessionId` (required): The ID of the debug session
- `file` (required): Path to the file to set the breakpoint in
- `line` (required): Line number to set the breakpoint on (1-based)
- `condition` (optional): Conditional expression for the breakpoint

**Example**:
```json
{
  "sessionId": "session-uuid",
  "file": "path/to/script.py",
  "line": 10,
  "condition": "x > 5"
}
```

**Returns**:
```json
{
  "success": true,
  "breakpointId": "breakpoint-uuid",
  "file": "path/to/script.py",
  "line": 10,
  "verified": true,
  "message": "Breakpoint set at path/to/script.py:10"
}
```

### start_debugging

Start debugging a script.

**Parameters**:
- `sessionId` (required): The ID of the debug session
- `scriptPath` (required): Path to the script to debug
- `args` (optional): Array of command line arguments

**Example**:
```json
{
  "sessionId": "session-uuid",
  "scriptPath": "path/to/script.py",
  "args": ["--option", "value"]
}
```

**Returns**:
```json
{
  "success": true,
  "state": "running",
  "message": "Started debugging path/to/script.py"
}
```

### close_debug_session

Close a debugging session.

**Parameters**:
- `sessionId` (required): The ID of the debug session

**Example**:
```json
{
  "sessionId": "session-uuid"
}
```

**Returns**:
```json
{
  "success": true,
  "message": "Closed debug session: session-uuid"
}
```

## Workflow Example

Here's an example of how an LLM might use the Debug MCP Server to debug a Python script:

1. Create a debug session:
```
use_mcp_tool(
  server_name="debug-mcp-server",
  tool_name="create_debug_session",
  arguments={
    "language": "python",
    "name": "Example Debugging"
  }
)
```

2. Set a breakpoint where the bug might be:
```
use_mcp_tool(
  server_name="debug-mcp-server",
  tool_name="set_breakpoint",
  arguments={
    "sessionId": "the-session-id",
    "file": "buggy_script.py",
    "line": 25
  }
)
```

3. Start debugging the script:
```
use_mcp_tool(
  server_name="debug-mcp-server",
  tool_name="start_debugging",
  arguments={
    "sessionId": "the-session-id",
    "scriptPath": "buggy_script.py"
  }
)
```

4. After examining variables and execution state, close the session:
```
use_mcp_tool(
  server_name="debug-mcp-server",
  tool_name="close_debug_session",
  arguments={
    "sessionId": "the-session-id"
  }
)
```

## Future Enhancements

- Support for additional programming languages (JavaScript, Java, C++, etc.)
- Variable inspection and manipulation
- Step over/into/out operations
- Stack trace navigation
- Conditional breakpoints 
- Debug REPL for expression evaluation
