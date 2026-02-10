# src/server.ts
@source-hash: 4593128da37ebefe
@generated: 2026-02-10T01:19:12Z

## Primary Purpose
Main MCP (Model Context Protocol) server implementation for debugging services. Exposes debugging capabilities as MCP tools to enable AI agents to debug code across multiple languages. Handles session management, breakpoint control, stepping, variable inspection, and expression evaluation.

## Core Architecture
- **DebugMcpServer (L103-437)**: Main server class implementing MCP protocol
- **MCP Server Setup (L393-408)**: Standard MCP server with tool capabilities
- **Tool Registration (L447-526)**: Defines 20+ debugging tools via JSON Schema
- **Tool Handler (L528-1110)**: Massive switch statement processing all tool requests

## Key Dependencies
- `@modelcontextprotocol/sdk`: MCP protocol implementation
- `SessionManager (L19, 402)`: Core debug session lifecycle management
- `SimpleFileChecker (L32, 381-385)`: File existence validation with container path mapping
- `LineReader (L33, 387-391)`: Source code context extraction
- Production dependencies via dependency injection container (L20, 375)

## Language Support & Discovery
- **Dynamic Language Discovery (L113-150)**: Queries adapter registry for available languages
- **Container Mode Handling (L129, 141, 147)**: Special python support in containerized environments  
- **Default Languages (L36-40)**: Fallback to python/mock if registry unavailable
- **Language Filtering (L1427-1436)**: Respects disabled language configuration

## Core Debugging Operations

### Session Management
- **createDebugSession (L216-248)**: Creates new debug sessions with language validation
- **startDebugging (L250-279)**: Launches scripts with file path validation
- **closeDebugSession (L281-283)**: Session cleanup

### Breakpoint Control  
- **setBreakpoint (L285-299)**: Sets breakpoints with file validation and line context
- Line context extraction for better UX (L649-683)

### Execution Control
- **continueExecution (L330-337)**: Resume execution
- **Step Operations (L339-364)**: stepOver, stepInto, stepOut with location context
- **Attach/Detach (L772-856)**: Remote debugging support

### Variable Inspection
- **getVariables (L301-304)**: Get variables by reference ID
- **getLocalVariables (L321-328)**: Convenience method for current frame locals
- **getStackTrace (L306-314)**: Stack frame inspection with internal filtering
- **evaluateExpression (L1146-1206)**: Expression evaluation in debug context

## File System Integration
- **File Validation (L261-265, L289-293)**: Validates script/breakpoint files exist before operations
- **Container Path Mapping**: FileChecker handles container vs host path resolution
- **Source Context (L1208-1273)**: Extracts surrounding code lines for breakpoints/steps

## Error Handling Patterns
- **Session Validation (L204-213)**: Checks session exists and not terminated
- **Custom Error Types**: SessionNotFoundError, SessionTerminatedError, ProxyNotRunningError
- **Graceful Degradation**: Tools return structured error responses vs throwing

## Tool Schema Generation  
- **Dynamic Tool Definitions (L448-526)**: Tool schemas generated at request time with current language list
- **Path Parameter Descriptions (L438-445)**: Generic path guidance for cross-platform compatibility
- **Comprehensive Tool Set**: 20+ tools covering full debug lifecycle

## Logging & Observability
- **Structured Logging**: Consistent event logging with sessionId, timestamps, sanitized data
- **Request Sanitization (L413-424)**: Removes sensitive paths/data from logs  
- **Audit Trail**: Tracks session lifecycle, breakpoints, variable access
- **Tool Call Tracking (L534-541, L1084-1090)**: Logs all tool invocations and responses

## Configuration & Environment
- **Container Detection**: Special handling for MCP_CONTAINER=true environments
- **Language Configuration**: Respects disabled language settings
- **Dependency Injection**: Uses production container for all dependencies

## Critical Invariants
- Sessions must be validated before operations (validateSession called throughout)
- File paths are always validated before debug operations
- Tool responses are consistently structured JSON with success/error fields
- Language support is dynamically discovered but cached per request cycle