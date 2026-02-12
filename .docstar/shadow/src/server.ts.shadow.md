# src/server.ts
@source-hash: 7b017e2dfe342221
@generated: 2026-02-11T16:12:55Z

**Primary Purpose:**
Main MCP (Model Context Protocol) server implementation for debugging functionality. Provides a bridge between AI agents and debug adapters, exposing debug operations as MCP tools.

**Key Architecture:**
- **DebugMcpServer class (L103-1429)**: Core server that wraps SessionManager and exposes debug operations as MCP tools
- **Tool-based interface**: 16 MCP tools for debug operations (create session, set breakpoints, step execution, etc.)
- **Dynamic language discovery**: Runtime detection of available debug adapters via adapter registry
- **Container-aware**: Special handling for containerized environments (Python debugging priority)

**Core Dependencies:**
- `SessionManager` from `./session/session-manager.js` - handles debug session lifecycle
- `@modelcontextprotocol/sdk` - MCP protocol implementation
- `SimpleFileChecker` and `LineReader` utilities for file validation and source context
- Debug adapter registry for language support discovery

**Key Methods:**
- **Constructor (L358-401)**: Sets up MCP server, dependencies, and tool registration
- **createDebugSession (L208-240)**: Creates new debug sessions with language validation
- **startDebugging (L242-271)**: Launches debug sessions with file validation
- **registerTools (L439-1102)**: Registers all 16 MCP tools with schemas and handlers
- **Tool handlers**: Each MCP tool maps to corresponding SessionManager operations

**Language Support:**
- **Dynamic discovery (L113-150)**: Queries adapter registry for available languages
- **Default languages (L36)**: Python and mock adapters as fallback
- **Container mode**: Ensures Python is always available in containerized environments
- **Language metadata (L153-191)**: Provides display names and requirements for each language

**Error Handling:**
- Custom error types: `SessionNotFoundError`, `SessionTerminatedError`, `UnsupportedLanguageError`
- Session validation before operations (L196-205)
- Graceful error responses in JSON format for tool calls

**File Path Handling:**
- **SimpleFileChecker integration**: Validates file existence before operations
- **Container path resolution**: Handles path mapping between host and container
- **LineReader integration**: Provides source code context for debugging operations

**Tool Categories:**
1. **Session Management**: create_debug_session, list_debug_sessions, close_debug_session
2. **Debugging Control**: start_debugging, attach_to_process, detach_from_process
3. **Execution Control**: step_over, step_into, step_out, continue_execution, pause_execution
4. **Inspection**: get_variables, get_local_variables, get_stack_trace, get_scopes
5. **Evaluation**: evaluate_expression, get_source_context
6. **Discovery**: list_supported_languages

**Logging Strategy:**
- Structured logging with event types (tool:call, session:created, debug:breakpoint)
- Request sanitization for security (removes absolute paths, truncates large data)
- Session context tracking in all log entries