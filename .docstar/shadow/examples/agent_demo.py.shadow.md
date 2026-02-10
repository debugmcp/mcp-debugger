# examples/agent_demo.py
@source-hash: 98d6ab5a2f9e4c59
@generated: 2026-02-10T00:42:00Z

## Purpose
Demonstrates an autonomous LLM agent that executes a predefined debugging workflow using the debug-mcp-server. The agent creates a debug session, sets breakpoints, starts debugging, and inspects execution state in a systematic manner.

## Key Components

### Configuration
- `MCP_SERVER_URL` (L11): Server endpoint for MCP tool calls
- Target script: `examples/python_simple_swap/swap_vars.py` (L56, L150)

### Core Functions
- `call_mcp_tool()` (L14-46): HTTP client for MCP tool invocations
  - Handles JSON-RPC 2.0 protocol formatting
  - Manages session ID propagation via headers
  - Parses and processes tool results with error handling
  - Returns tuple of (processed_result, session_id)

### Agent Architecture
- `MockLLM` (L49-94): Simulated LLM with predefined action plan
  - Maintains conversation history and execution state
  - Stores `debug_session_id` and `mcp_http_session_id` for session continuity
  - `think()` method (L66-94): Returns next tool action or None when complete
  - Dynamic parameter injection for sessionId requirements

### Execution Plan
The agent follows a hardcoded sequence (L52-61):
1. Create debug session with Python language support
2. Set breakpoint at line 9 of swap_vars.py
3. Start debugging the target script
4. Retrieve stack trace when breakpoint hits
5. Close debug session for cleanup

### Main Loop
- `agent_loop()` (L96-146): Core execution engine
  - Iterative observation-action cycle (max 10 iterations)
  - Tool result processing and state updates
  - Error handling with fallback observation
  - Cleanup logic for orphaned debug sessions
- `main` (L148-159): Entry point with prerequisite validation

## Dependencies
- `requests`: HTTP client for MCP server communication
- `json`, `time`, `os`, `uuid`, `sys`: Standard library utilities

## Key Patterns
- **Session Management**: Dual session tracking (MCP HTTP + debug session)
- **State Propagation**: Automatic sessionId injection based on tool requirements
- **Error Recovery**: Graceful error handling with cleanup guarantees
- **Path Resolution**: Automatic conversion of relative to absolute file paths

## Constraints
- Hardcoded execution plan (not dynamically generated)
- Requires pre-existing target script at expected location
- No retry logic for failed tool calls
- Fixed 3-second wait assumption for breakpoint activation (L128)