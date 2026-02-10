# packages/adapter-java/src/jdb-dap-server.ts
@source-hash: 9b62d776b8704211
@generated: 2026-02-10T00:41:30Z

## JDB DAP Server

A Node.js TCP server that implements the Debug Adapter Protocol (DAP) for Java debugging via the JDB command-line debugger. Acts as a bridge between DAP-compliant debug clients (like VS Code) and the JDB debugger.

### Core Architecture

**JdbDapServer Class (L87-776)**: Main server implementation that handles:
- TCP server management for DAP client connections
- DAP message parsing (Content-Length + JSON protocol)
- Request/response routing to appropriate handlers
- JDB process lifecycle management via JdbWrapper

### Key Components

**Configuration Interfaces**:
- `ServerConfig` (L27-31): Server port, JDB path, session ID
- `LaunchAttachArgs` (L36-50): Client-provided launch/attach parameters

**Command Line Parsing** (L55-82): 
- `parseArgs()`: Parses --port, --jdb-path, --session-id arguments
- Exits with usage message if required args missing

**TCP Connection Management** (L120-137):
- `handleConnection()`: Sets up socket event handlers for data, end, error
- `onData()` (L142-171): Implements DAP message framing protocol
- `messageBuffer`: Accumulates incoming data for complete message parsing

**DAP Request Handling** (L185-240):
Central dispatch in `handleRequest()` supports:
- `initialize`: Advertises server capabilities
- `launch`/`attach`: Starts/connects to Java process
- `setBreakpoints`: Manages breakpoint state
- `configurationDone`: Triggers program execution
- `threads`/`stackTrace`/`scopes`/`variables`: Debug introspection
- `continue`/`next`/`stepIn`/`stepOut`: Execution control
- `evaluate`: Expression evaluation
- `disconnect`: Cleanup and shutdown

### Critical Implementation Details

**Breakpoint Management** (L410-453):
- Maintains `Map<string, JdbBreakpoint[]>` for file-to-breakpoints mapping
- Clears existing breakpoints before setting new ones
- Returns verification status for each breakpoint

**Launch vs Attach Modes**:
- `handleLaunch()` (L270-298): Spawns new JVM with specified main class
- `handleAttach()` (L303-346): Connects to existing JVM via socket
- `isAttachMode` flag controls whether to run program in `configurationDone()`

**Stop-on-Entry Support** (L458-507):
- Uses `extractFullyQualifiedClassName()` (L514-536) to parse Java package declarations
- Sets JDB breakpoint on `<FQN>.main` method
- `isStoppingAtEntry` flag modifies stopped event reason

**JDB Event Bridge** (L351-405):
- Maps JDB events to DAP events (stopped, continued, output, terminated, error)
- Handles thread ID translation and event body formatting

**Message Protocol** (L750-758):
- `sendMessage()`: Implements DAP Content-Length header protocol
- Manages sequence numbering for request/response correlation

### Dependencies
- `@vscode/debugprotocol`: DAP type definitions
- `./utils/jdb-wrapper.js`: JDB process management and command translation
- `./utils/jdb-parser.js`: JDB output parsing utilities
- Node.js `net`, `fs`, `path`: Core I/O operations

### Error Handling
- Try-catch blocks around all async operations
- Standardized error response format via `sendErrorResponse()`
- Graceful cleanup on connection loss or process termination

### Entry Point
Main execution (L779-781) parses CLI args and starts the TCP server.