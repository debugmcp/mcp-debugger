# Python Debugging with mcp-debugger

mcp-debugger supports Python debugging through [debugpy](https://github.com/microsoft/debugpy). You can either launch Python directly from MCP or attach MCP to an already-running `debugpy` endpoint for a VS Code handoff.

## Prerequisites

Before using the Python adapter, ensure you have:

1. Python 3.7 or higher installed
2. `debugpy` installed in the Python environment you want to debug

```bash
pip install debugpy
```

## Launch a Python program from MCP

### 1. Create a session

```text
use_mcp_tool(
  tool_name="create_debug_session",
  arguments={
    "language": "python",
    "name": "My Python Debug Session"
  }
)
```

### 2. Set breakpoints

```text
use_mcp_tool(
  tool_name="set_breakpoint",
  arguments={
    "sessionId": "your-session-id",
    "file": "/path/to/your/script.py",
    "line": 10
  }
)
```

You can also set conditional breakpoints:

```text
use_mcp_tool(
  tool_name="set_breakpoint",
  arguments={
    "sessionId": "your-session-id",
    "file": "/path/to/your/script.py",
    "line": 15,
    "condition": "x > 5"
  }
)
```

### 3. Start debugging

```text
use_mcp_tool(
  tool_name="start_debugging",
  arguments={
    "sessionId": "your-session-id",
    "scriptPath": "/path/to/your/script.py",
    "args": ["--optional", "arguments"]
  }
)
```

### 4. Control execution

```text
use_mcp_tool(tool_name="step_over", arguments={ "sessionId": "your-session-id" })
use_mcp_tool(tool_name="step_into", arguments={ "sessionId": "your-session-id" })
use_mcp_tool(tool_name="step_out", arguments={ "sessionId": "your-session-id" })
use_mcp_tool(tool_name="continue_execution", arguments={ "sessionId": "your-session-id" })
use_mcp_tool(tool_name="pause_execution", arguments={ "sessionId": "your-session-id" })
```

### 5. Inspect state

When paused, the most direct inspection flow is:

1. `get_stack_trace`
2. `get_scopes`
3. `get_variables`

For a shortcut, use `get_local_variables`:

```text
use_mcp_tool(
  tool_name="get_local_variables",
  arguments={
    "sessionId": "your-session-id"
  }
)
```

Evaluate expressions in the current frame:

```text
use_mcp_tool(
  tool_name="evaluate_expression",
  arguments={
    "sessionId": "your-session-id",
    "expression": "x + y * 2"
  }
)
```

Get source context around the current line:

```text
use_mcp_tool(
  tool_name="get_source_context",
  arguments={
    "sessionId": "your-session-id",
    "file": "/path/to/your/script.py",
    "line": 15,
    "linesContext": 5
  }
)
```

### 6. Close the session

```text
use_mcp_tool(
  tool_name="close_debug_session",
  arguments={
    "sessionId": "your-session-id"
  }
)
```

## VS Code handoff with `attach_to_process`

Issue #7 asked for a practical way to move from MCP-driven debugging into VS Code. The supported workflow is a handoff through a shared `debugpy` endpoint:

1. Start the target under `debugpy`
2. Attach `mcp-debugger` to that port
3. Detach MCP when you are ready
4. Attach VS Code to the same host and port

### 1. Start the target with `debugpy`

```bash
python -m debugpy --listen 127.0.0.1:5678 --wait-for-client app.py
```

### 2. Attach MCP

```text
use_mcp_tool(
  tool_name="create_debug_session",
  arguments={
    "language": "python",
    "name": "Python Attach Session"
  }
)
```

```text
use_mcp_tool(
  tool_name="attach_to_process",
  arguments={
    "sessionId": "your-session-id",
    "host": "127.0.0.1",
    "port": 5678,
    "sourcePaths": ["/path/to/your/workspace"]
  }
)
```

`sourcePaths` becomes `pathMappings` for the Python attach configuration, which keeps local source lookup aligned with the debug target.

### 3. Detach MCP before opening VS Code

Use `detach_from_process` when you want to hand control to VS Code:

```text
use_mcp_tool(
  tool_name="detach_from_process",
  arguments={
    "sessionId": "your-session-id"
  }
)
```

Treat this as a handoff, not a simultaneous dual-client session.

### 4. Attach VS Code to the same `debugpy` endpoint

Add a `launch.json` entry like this:

```json
{
  "name": "Python: Attach to debugpy",
  "type": "python",
  "request": "attach",
  "connect": {
    "host": "127.0.0.1",
    "port": 5678
  },
  "justMyCode": true,
  "pathMappings": [
    {
      "localRoot": "${workspaceFolder}",
      "remoteRoot": "${workspaceFolder}"
    }
  ]
}
```

## Tips

1. Breakpoints are only fully verified after the adapter finishes initialization.
2. Prefer absolute file paths when debugging across shells, containers, or editors.
3. If breakpoints do not bind, confirm the Python interpreter that launched `debugpy` matches the code you are editing.
4. Use `get_local_variables` for fast MCP inspection and switch to the full stack/scopes flow only when you need more detail.
