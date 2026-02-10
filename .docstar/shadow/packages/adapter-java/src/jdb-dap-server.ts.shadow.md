# packages/adapter-java/src/jdb-dap-server.ts
@source-hash: 9b62d776b8704211
@generated: 2026-02-09T18:14:37Z

## JDB DAP Server

Node.js executable that implements the Debug Adapter Protocol (DAP) for Java debugging via jdb. Bridges DAP client requests to jdb commands and translates jdb events back to DAP format.

### Core Architecture

**JdbDapServer class (L87-776)**: Main server implementation managing TCP connections, DAP message parsing, and jdb orchestration.

**Key interfaces**:
- `ServerConfig (L27-31)`: Server configuration (port, jdbPath, sessionId)
- `LaunchAttachArgs (L36-50)`: Launch/attach parameters from DAP client

### Request Flow

**Message handling pipeline**:
- `handleConnection (L120-137)`: Accepts TCP connections from DAP clients
- `onData (L142-171)`: Parses DAP messages using Content-Length protocol
- `handleMessage/handleRequest (L176-240)`: Routes DAP requests to specific handlers

**Core DAP handlers**:
- `handleInitialize (L245-265)`: Reports server capabilities
- `handleLaunch (L270-298)`: Spawns jdb with program configuration
- `handleAttach (L303-346)`: Attaches to running Java process via remote debugging
- `handleSetBreakpoints (L410-453)`: Manages breakpoint state and jdb breakpoint commands
- `handleConfigurationDone (L458-507)`: Triggers program execution, handles stopOnEntry logic

**Execution control handlers**:
- `handleContinue/handleNext/handleStepIn/handleStepOut (L622-669)`: Delegate to jdb wrapper
- `handleStackTrace (L560-581)`: Retrieves and formats stack frames
- `handleVariables (L601-617)`: Exposes local variables from jdb
- `handleEvaluate (L674-690)`: Expression evaluation via jdb

### JDB Integration

**Event forwarding (L351-405)**: `setupJdbEventHandlers` maps jdb events to DAP events:
- `stopped` → DAP stopped event with reason (breakpoint/step/entry)
- `continued` → DAP continued event
- `output` → DAP output event for stdout
- `terminated/error` → DAP terminated/output events

**State management**:
- `breakpoints (L93)`: Maps file paths to JdbBreakpoint arrays
- `isAttachMode (L95)`: Distinguishes launch vs attach workflows
- `isStoppingAtEntry (L97)`: Tracks entry breakpoint handling

### Utilities

**parseArgs (L55-82)**: Command-line argument parser requiring --port, --jdb-path, --session-id

**extractFullyQualifiedClassName (L514-536)**: Parses Java files to extract package.Class for entry breakpoints

**Message protocol (L750-758)**: `sendMessage` implements DAP Content-Length header format

### Dependencies

- `JdbWrapper` from `./utils/jdb-wrapper.js`: Core jdb process management
- `JdbParser` types from `./utils/jdb-parser.js`: Event/data structure definitions
- `@vscode/debugprotocol`: DAP type definitions

### Entry Point

Main execution (L779-781): Parses args, creates server instance, starts listening on configured port.