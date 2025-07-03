# Screenshot Capture Guide

This guide explains how to capture authentic screenshots of the MCP debugger in action using real debugging sessions.

## Prerequisites

1. Build the MCP server:
   ```bash
   npm run build
   ```

2. Install visualizer dependencies:
   ```bash
   cd examples/visualizer
   pip install -r requirements.txt
   ```

## Setup

1. **Terminal 1**: Start the demo runner (includes server + visualizer)
   ```bash
   python examples/visualizer/demo_runner.py
   ```

2. **Terminal 2**: Connect your MCP client (Claude Desktop, etc.) to the running server

3. **Prepare for screenshots**: Use your OS screenshot tool:
   - **Windows**: Win+Shift+S (Snipping Tool)
   - **macOS**: Cmd+Shift+4 (area selection)
   - **Linux**: Screenshot tool or `gnome-screenshot -a`

## Capture Sequence

### 1. Debugging Session (`debugging-session.png`)

**MCP Commands:**
```json
// Create a Python debug session
{
  "tool": "create_debug_session",
  "arguments": {
    "language": "python",
    "name": "Debug swap_vars.py"
  }
}

// Set breakpoint at line 4
{
  "tool": "set_breakpoint",
  "arguments": {
    "sessionId": "<session-id-from-previous-command>",
    "file": "examples/python_simple_swap/swap_vars.py",
    "line": 4
  }
}

// Start debugging
{
  "tool": "start_debugging",
  "arguments": {
    "sessionId": "<session-id>",
    "scriptPath": "examples/python_simple_swap/swap_vars.py"
  }
}
```

**What to capture:**
- Terminal showing visualizer with:
  - Active breakpoint marker (●) at line 4
  - Current line indicator (→) where debugger is paused
  - Stack trace visible in the tool panel
  - Tool activity showing the pause event

### 2. Variable Inspection (`variable-inspection.png`)

**MCP Commands (while paused at line 4):**
```json
// Get stack trace
{
  "tool": "get_stack_trace",
  "arguments": {
    "sessionId": "<session-id>"
  }
}

// Get scopes for the main frame
{
  "tool": "get_scopes",
  "arguments": {
    "sessionId": "<session-id>",
    "frameId": 0
  }
}

// Get variables (use variablesReference from scopes response)
{
  "tool": "get_variables",
  "arguments": {
    "sessionId": "<session-id>",
    "scope": <variablesReference>
  }
}

// Step over to line 5
{
  "tool": "step_over",
  "arguments": {
    "sessionId": "<session-id>"
  }
}

// Get variables again to see the bug
{
  "tool": "get_variables",
  "arguments": {
    "sessionId": "<session-id>",
    "scope": <variablesReference>
  }
}
```

**What to capture:**
- Variables displayed at bottom of code panel
- The bug visible: after stepping to line 5, both a=20 and b=20
- Tool activity showing get_variables calls and responses

### 3. MCP Integration (`mcp-integration.png`)

**What to capture:**
- Scroll the tool panel to show clear JSON request/response pairs
- Should show:
  - tool:call entries with the actual MCP request format
  - tool:response entries with structured JSON responses
  - Multiple tool activities in sequence
- This demonstrates the actual protocol communication

### 4. Multi-session View (`multi-session.png`)

**MCP Commands:**
```json
// Create multiple sessions
{
  "tool": "create_debug_session",
  "arguments": {
    "language": "python",
    "name": "Production Debug"
  }
}

{
  "tool": "create_debug_session",
  "arguments": {
    "language": "python",
    "name": "Test Environment"
  }
}

{
  "tool": "create_debug_session",
  "arguments": {
    "language": "python",
    "name": "Feature Branch"
  }
}

// List all sessions
{
  "tool": "list_debug_sessions",
  "arguments": {}
}
```

**What to capture:**
- Terminal showing list_debug_sessions output
- Multiple active sessions with IDs and names
- Different session states if you've started debugging in some

## Screenshot Guidelines

1. **Consistency**: Use the same terminal window size for all captures (recommended: 1200x800)
2. **Theme**: Ensure terminal has good contrast (dark or light theme)
3. **Focus**: Capture only the terminal window, not the entire desktop
4. **Quality**: Save as PNG for best quality

## Saving Screenshots

Save all screenshots to: `assets/screenshots/`

With these exact filenames:
- `debugging-session.png`
- `variable-inspection.png`
- `mcp-integration.png`
- `multi-session.png`

## Important Notes

- These must be REAL debugging sessions - no mock data
- The swap_vars.py bug (where both variables become 20) is a real bug that demonstrates the debugger working correctly
- All JSON shown is actual MCP protocol communication
- Anyone following these steps will see the same behavior

## Troubleshooting

If the visualizer doesn't update:
1. Check that the log file exists: `logs/debug-mcp-server.log`
2. Ensure the MCP server started successfully
3. Verify your MCP client is connected to the correct server instance

If you don't see the bug in swap_vars.py:
1. Make sure you're paused at line 4 first
2. Check variables (should be a=10, b=20)
3. Step over to line 5
4. Check variables again (bug: both are now 20)
