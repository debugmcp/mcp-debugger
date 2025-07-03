# MCP Debugger Demo Script

## Recording Setup
1. Terminal 1: `python prepare_demo_recording.py` then `python demo_runner.py`
2. Terminal 2: `python record_session.py` (start recording)
3. Terminal 3: Your MCP client connected to the server

## Demo Sequence (30-40 seconds)

### 1. Create Debug Session (5s)
```
Use MCP tool: create_debug_session
Args: {"language": "python", "name": "Swap Variables Debug"}
```
**Action**: Execute command  
**Wait**: 2-3 seconds for session ID to appear in visualizer

### 2. Set Breakpoint (5s)
```
Use MCP tool: set_breakpoint
Args: {"sessionId": "<session-id>", "file": "examples/python_simple_swap/swap_vars.py", "line": 4}
```
**Note**: Line 4 is where the bug occurs: `a = b  # Bug: 'a' loses its original value here`  
**Action**: Execute command  
**Wait**: 2-3 seconds to see breakpoint marker in visualizer

### 3. Start Debugging (5s)
```
Use MCP tool: start_debugging
Args: {"sessionId": "<session-id>", "scriptPath": "examples/python_simple_swap/swap_vars.py"}
```
**Action**: Execute command  
**Wait**: 2-3 seconds - execution pauses at breakpoint

### 4. Get Stack Trace (3s)
```
Use MCP tool: get_stack_trace
Args: {"sessionId": "<session-id>"}
```
**Action**: Execute command  
**Wait**: 2 seconds to see call stack

### 5. Get Variables (5s)
```
Use MCP tool: get_scopes
Args: {"sessionId": "<session-id>", "frameId": 0}
```
Then:
```
Use MCP tool: get_variables
Args: {"sessionId": "<session-id>", "scope": <variablesReference from scopes>}
```
**Expected**: Variables show a=10, b=20 (before the bug)  
**Wait**: 2-3 seconds to let viewers see the initial values

### 6. Step Over - See the Bug! (5s)
```
Use MCP tool: step_over
Args: {"sessionId": "<session-id>"}
```
**Action**: Execute command  
**Result**: Line advances to 5, variable 'a' now equals 20 (bug visible!)  
**Wait**: 3 seconds - this is the key moment showing the bug

### 7. Step Over Again (3s)
```
Use MCP tool: step_over
Args: {"sessionId": "<session-id>"}
```
**Result**: Both variables now have value 20 - swap failed!  
**Wait**: 2 seconds

### 8. Continue Execution (5s)
```
Use MCP tool: continue_execution
Args: {"sessionId": "<session-id>"}
```
**Action**: Execute command  
**Result**: Program completes, shows "Swap NOT successful"  
**Wait**: 2 seconds

### 9. End Recording
Press Ctrl+D in recording terminal

## Timing Summary
- Total demo length: ~35 seconds
- Key pauses between commands: 2-3 seconds
- Focus moment: Step 6 (seeing the bug happen)

## Tips for Recording
1. **Test Run**: Do a practice run first without recording
2. **Clear Terminal**: Start with a clean terminal for best visual
3. **Steady Pace**: Don't rush - viewers need time to see what's happening
4. **Highlight Bug**: Pause extra at step 6 when the bug becomes visible

## Alternative Shorter Demo (20 seconds)
If you need a shorter demo, skip steps 4 (stack trace) and combine the variable inspection steps.
