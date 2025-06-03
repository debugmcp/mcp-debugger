# Python Debugging with Debug MCP Server

The Debug MCP Server provides support for Python debugging through the [debugpy](https://github.com/microsoft/debugpy) library. This document explains how to use the Python debugging capabilities.

## Prerequisites

Before using the Python debugging features, ensure you have:

1. Python 3.7 or higher installed
2. The debugpy package installed:
   ```bash
   pip install debugpy
   ```

## Debugging Workflow

### 1. Create a Debug Session

First, create a Python debug session:

```
use_mcp_tool(
  server_name="debug-mcp-server",
  tool_name="create_debug_session",
  arguments={
    "language": "python",
    "name": "My Python Debug Session"
  }
)
```

This returns a session ID that you'll use for all subsequent debugging commands.

### 2. Set Breakpoints

Set breakpoints in your code before starting execution:

```
use_mcp_tool(
  server_name="debug-mcp-server",
  tool_name="set_breakpoint",
  arguments={
    "sessionId": "your-session-id",
    "file": "/path/to/your/script.py",
    "line": 10
  }
)
```

You can also set conditional breakpoints:

```
use_mcp_tool(
  server_name="debug-mcp-server",
  tool_name="set_breakpoint",
  arguments={
    "sessionId": "your-session-id",
    "file": "/path/to/your/script.py",
    "line": 15,
    "condition": "x > 5"
  }
)
```

### 3. Start Debugging

Start debugging your Python script:

```
use_mcp_tool(
  server_name="debug-mcp-server",
  tool_name="start_debugging",
  arguments={
    "sessionId": "your-session-id",
    "scriptPath": "/path/to/your/script.py",
    "args": ["--optional", "arguments"]
  }
)
```

### 4. Control Execution

When execution pauses at a breakpoint, you can:

#### Step Over (execute current line and pause at next line)
```
use_mcp_tool(
  server_name="debug-mcp-server",
  tool_name="step_over",
  arguments={
    "sessionId": "your-session-id"
  }
)
```

#### Step Into (go into functions called on current line)
```
use_mcp_tool(
  server_name="debug-mcp-server",
  tool_name="step_into",
  arguments={
    "sessionId": "your-session-id"
  }
)
```

#### Step Out (run until exiting current function)
```
use_mcp_tool(
  server_name="debug-mcp-server",
  tool_name="step_out",
  arguments={
    "sessionId": "your-session-id"
  }
)
```

#### Continue (run until next breakpoint)
```
use_mcp_tool(
  server_name="debug-mcp-server",
  tool_name="continue_execution",
  arguments={
    "sessionId": "your-session-id"
  }
)
```

#### Pause (pause a running program)
```
use_mcp_tool(
  server_name="debug-mcp-server",
  tool_name="pause_execution",
  arguments={
    "sessionId": "your-session-id"
  }
)
```

### 5. Examine Program State

When paused, you can examine the program's state:

#### Get Local Variables
```
use_mcp_tool(
  server_name="debug-mcp-server",
  tool_name="get_variables",
  arguments={
    "sessionId": "your-session-id",
    "scope": "local"
  }
)
```

#### Get Global Variables
```
use_mcp_tool(
  server_name="debug-mcp-server",
  tool_name="get_variables",
  arguments={
    "sessionId": "your-session-id",
    "scope": "global"
  }
)
```

#### Evaluate Expressions
```
use_mcp_tool(
  server_name="debug-mcp-server",
  tool_name="evaluate_expression",
  arguments={
    "sessionId": "your-session-id",
    "expression": "x + y * 2"
  }
)
```

#### View Stack Trace
```
use_mcp_tool(
  server_name="debug-mcp-server",
  tool_name="get_stack_trace",
  arguments={
    "sessionId": "your-session-id"
  }
)
```

#### Get Source Context
```
use_mcp_tool(
  server_name="debug-mcp-server",
  tool_name="get_source_context",
  arguments={
    "sessionId": "your-session-id",
    "file": "/path/to/your/script.py",
    "line": 15,
    "linesContext": 5
  }
)
```

### 6. Close the Session

When finished debugging, close the session:

```
use_mcp_tool(
  server_name="debug-mcp-server",
  tool_name="close_debug_session",
  arguments={
    "sessionId": "your-session-id"
  }
)
```

## Debugging Tips

1. Always check if breakpoints are verified (some lines cannot have breakpoints, like blank lines)
2. If the debugger doesn't stop at a breakpoint, ensure the file path is correct and absolute
3. Use source context to see code around your current position
4. The stack trace shows the call hierarchy that led to the current position
5. Expression evaluation runs in the context of the current stack frame
