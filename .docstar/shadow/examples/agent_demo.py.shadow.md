# examples/agent_demo.py
@source-hash: 98d6ab5a2f9e4c59
@generated: 2026-02-09T18:15:13Z

**Purpose**: Demonstrates an LLM agent that autonomously interacts with a debug-mcp-server to perform debugging operations through a predefined sequence of MCP tool calls.

## Key Components

### MCP Communication Layer
- `call_mcp_tool()` (L14-46): Core MCP client function that sends JSON-RPC requests to the debug server
  - Handles session management via HTTP headers
  - Processes and normalizes tool responses
  - Includes error handling and response parsing
  - Returns both result and updated session ID

### Mock Agent Implementation  
- `MockLLM` class (L49-94): Simulates an AI agent with predefined debugging workflow
  - `plan` (L52-61): Hardcoded sequence of debugging operations (create session → set breakpoint → start debugging → inspect → cleanup)
  - `think()` (L66-94): State machine that executes next planned action
  - Maintains both debug session ID and MCP HTTP session ID
  - Dynamically injects session IDs into tool arguments
  - Handles file path resolution for breakpoints

### Agent Control Loop
- `agent_loop()` (L96-146): Main execution engine
  - Iterative observation-action cycle with max 10 iterations
  - Processes tool results and updates agent state
  - Special handling for debug session creation and startup timing
  - Includes cleanup logic for unclosed debug sessions
  - Error recovery feeds exceptions back as observations

## Dependencies & Configuration
- Target script: `examples/python_simple_swap/swap_vars.py` (hardcoded)
- MCP server endpoint: `http://localhost:3000/mcp` (L11)
- External libraries: `requests`, `json`, `time`, `os`, `uuid`, `sys`

## Architectural Patterns
- **State Management**: Agent maintains both debugging context (session IDs) and execution state (current plan step)
- **Error Resilience**: Exceptions are captured and fed back as observations rather than terminating execution
- **Session Lifecycle**: Automatic cleanup ensures debug sessions don't leak if agent terminates unexpectedly
- **Timing Simulation**: Includes sleep delays to simulate realistic debugging workflow timing

## Critical Invariants
- Debug session ID must be injected into most tool calls except session creation/listing
- File paths for breakpoints must be absolute
- MCP HTTP session ID must be maintained across requests for proper server-side state management
- Agent plan execution is sequential and non-backtracking