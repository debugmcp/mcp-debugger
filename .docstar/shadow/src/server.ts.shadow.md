# src/server.ts
@source-hash: e152404eda33c6ed
@generated: 2026-02-09T18:15:33Z

# Debug MCP Server - Main Server Implementation

**Primary Purpose**: Main MCP (Model Context Protocol) server class that provides debugging tools for multiple programming languages through a standardized interface. Orchestrates debug sessions, breakpoints, stepping, and variable inspection via DAP (Debug Adapter Protocol).

## Core Architecture

**DebugMcpServer (L104-1438)**: Main server class that wraps MCP SDK server with debugging capabilities
- Manages multiple concurrent debug sessions via SessionManager
- Provides 18+ debugging tools through MCP protocol
- Handles dynamic language discovery and validation
- Implements file path resolution for container environments

**Dependencies**:
- `@modelcontextprotocol/sdk` for MCP protocol handling
- `SessionManager` for debug session lifecycle
- `SimpleFileChecker` and `LineReader` for file operations  
- Container dependency injection system

## Key Interfaces

**DebugMcpServerOptions (L53-56)**: Configuration for server initialization
- `logLevel`, `logFile` for logging configuration

**ToolArguments (L72-99)**: Comprehensive argument interface for all debugging tools
- Session management: `sessionId`, `language`, `name`
- Debugging: `file`, `line`, `condition`, `scriptPath`, `args`
- DAP integration: `dapLaunchArgs`, `adapterLaunchConfig`
- Attach mode: `port`, `host`, `processId`, `timeout`

**LanguageMetadata (L61-67)**: Language capability description
- Runtime requirements and default executables

## Core Methods

### Session Management
- `createDebugSession()` (L217-249): Creates new debug sessions with language validation
- `closeDebugSession()` (L282-284): Terminates debug sessions
- `getSupportedLanguagesAsync()` (L114-151): Dynamic language discovery with container support

### Debugging Operations
- `startDebugging()` (L251-280): Launches scripts with file validation
- `setBreakpoint()` (L286-300): Sets breakpoints with file existence checks
- `continueExecution()`, `stepOver()`, `stepInto()`, `stepOut()` (L331-365): Execution control
- `getStackTrace()` (L307-315): Stack frame inspection
- `getVariables()` (L302-305): Variable inspection by reference
- `getLocalVariables()` (L322-329): Convenience method for local scope variables

### Tool Registration
- `registerTools()` (L448-1111): Registers 18 MCP tools with comprehensive schemas
- `CallToolRequestSchema` handler (L529-1111): Main request dispatcher with error handling

## Language Support

**DEFAULT_LANGUAGES (L37)**: `['python', 'mock']` as fallback languages

**Dynamic Discovery**: Queries adapter registry for available languages, with special handling for:
- Container environments (ensures Python availability)
- Disabled languages via configuration
- Runtime language validation

**Supported Languages**: Python, JavaScript/TypeScript, Java, Mock (for testing)

## Error Handling

**Validation**: 
- `validateSession()` (L205-214): Session existence and termination checks
- File existence validation for scripts and breakpoint files
- Language support validation

**Error Types**: 
- `SessionNotFoundError`, `SessionTerminatedError` for session issues
- `UnsupportedLanguageError` for language validation
- `ProxyNotRunningError` for debugging state issues

## Path Handling

**File Resolution**: Uses `SimpleFileChecker` for cross-platform path handling
- Container path mapping support
- Absolute/relative path resolution
- File existence validation with detailed error messages

## Logging & Telemetry

**Structured Logging**: Comprehensive event tracking
- `tool:call`, `tool:response`, `tool:error` for request lifecycle
- `session:created`, `session:closed` for session management  
- `debug:breakpoint`, `debug:variables` for debugging events

**Request Sanitization** (L414-425): Removes sensitive data (absolute paths, truncates arrays)

## Container Support

**Environment Detection**: `process.env.MCP_CONTAINER === 'true'`
- Special Python language handling in containers
- Container-aware path resolution
- Session log directory configuration

## Notable Patterns

- **Defensive Programming**: Extensive validation and graceful error handling
- **Dependency Injection**: Uses production dependencies container
- **Async/Promise-based**: All operations return promises
- **Tool Schema Generation**: Dynamic schema generation based on runtime language support
- **Context Preservation**: Maintains line context for breakpoints and stepping operations