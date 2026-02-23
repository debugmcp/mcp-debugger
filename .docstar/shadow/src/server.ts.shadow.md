# src\server.ts
@source-hash: c0e8fb52d26c50d1
@generated: 2026-02-23T15:26:13Z

## Debug MCP Server - Main Server Implementation

Primary purpose: Main server class for a Model Context Protocol (MCP) debug server that provides debugging capabilities across multiple programming languages. Handles debug session lifecycle, breakpoints, stepping, variable inspection, and expression evaluation.

### Key Components

**DebugMcpServer Class (L105-1438)**
- Main server class implementing MCP protocol for debugging
- Manages multiple concurrent debug sessions via SessionManager
- Provides file validation and container path resolution
- Handles 18 debug tools including session management, breakpoints, stepping, and variable inspection

**Configuration Interfaces**
- `DebugMcpServerOptions` (L54-57): Server configuration with logging options
- `LanguageMetadata` (L62-68): Language metadata including executables and display names  
- `ToolArguments` (L73-100): Comprehensive tool parameter interface supporting launch/attach modes

**Language Support System**
- Dynamic language discovery via `getSupportedLanguagesAsync()` (L116-153)
- Container environment support with Python defaults
- Language filtering for disabled languages
- Metadata mapping for Python, JavaScript, and Mock languages (L156-194)

### Core Functionality

**Session Management**
- `createDebugSession()` (L211-243): Creates sessions with language validation
- `startDebugging()` (L245-273): Launches debug sessions with file validation
- Session lifecycle validation via `validateSession()` (L199-208)

**Debug Operations**
- Breakpoint management: `setBreakpoint()` (L279-292)
- Execution control: `stepOver/Into/Out()`, `continueExecution()` (L323-357)
- Variable inspection: `getVariables()`, `getLocalVariables()`, `getStackTrace()` (L294-321)
- Expression evaluation and source context retrieval

**File System Integration**
- Uses SimpleFileChecker for existence validation with container path resolution
- LineReader for source context retrieval around breakpoints/current execution
- Container-aware path handling for Docker environments

**Tool Registration (L451-1113)**
Registers 18 MCP tools with comprehensive input schemas:
- Session management: create_debug_session, list_debug_sessions, close_debug_session
- Debug control: start_debugging, attach_to_process, detach_from_process
- Execution: step_over, step_into, step_out, continue_execution, pause_execution
- Inspection: get_variables, get_local_variables, get_stack_trace, get_scopes
- Advanced: evaluate_expression, get_source_context, set_breakpoint
- Discovery: list_supported_languages

### Dependencies & Integration

**External Dependencies**
- SessionManager: Core debug session orchestration
- SimpleFileChecker & LineReader: File system operations
- AdapterRegistry: Language-specific debug adapter management
- MCP SDK: Protocol implementation and error handling

**Container Support**
- Environment detection via `isContainerMode()`
- Workspace root resolution for Docker volume mounts
- Path translation between host and container contexts

**Error Handling**
- Comprehensive error categorization (session state, file validation, proxy errors)
- Structured logging with sanitized request data
- Graceful degradation for missing features

### Architectural Patterns

- Dependency injection via createProductionDependencies()
- Factory pattern for language adapters
- Command pattern for tool execution
- Observer pattern for session state tracking
- Strategy pattern for container vs native path handling

The server supports both launch mode (starting new processes) and attach mode (connecting to running processes) with language-agnostic debugging capabilities.