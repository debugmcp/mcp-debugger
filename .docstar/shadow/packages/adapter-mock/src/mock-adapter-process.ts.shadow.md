# packages/adapter-mock/src/mock-adapter-process.ts
@source-hash: 478c902562832db2
@generated: 2026-02-10T00:41:36Z

## Primary Purpose
Mock Debug Adapter Process that simulates a DAP (Debug Adapter Protocol) server for testing. Provides a complete DAP implementation that can communicate via stdin/stdout or TCP, handling all standard debugging operations with simulated responses.

## Key Components

### DAPConnection (L16-86)
Low-level DAP protocol handler managing message parsing and transport.
- **Constructor (L19-22)**: Configures input/output streams (defaults to stdin/stdout)
- **start() (L24-28)**: Initiates message listening on input stream
- **on() (L31-38)**: Event registration for 'request' and 'disconnect' events
- **processMessages() (L50-79)**: Parses Content-Length headers and extracts JSON messages
- **sendMessage() (L81-85)**: Formats and sends DAP protocol messages with proper headers
- **messageBuffer (L17)**: Accumulates partial messages during parsing

### MockDebugAdapterProcess (L95-768)
Main debug adapter implementation with comprehensive DAP command support.

#### Core State Management (L98-104)
- **breakpoints (L99)**: Map of file paths to breakpoint arrays
- **variableHandles (L100)**: Maps variable references to scope data
- **currentLine (L102)**: Simulated execution position
- **isRunning/isInitialized (L98, L103)**: Execution state tracking

#### Command Line Processing (L107-141)
Parses `--port`, `--host`, `--session` arguments to configure transport mode (TCP vs stdio).

#### Transport Setup
- **setupTCPServer() (L144-171)**: Creates TCP server for remote connections with client reconnection support
- **setupConnection() (L173-183)**: Configures message handlers and disconnect behavior

#### DAP Command Handlers (L190-731)
Complete implementation of standard DAP commands:
- **handleInitialize() (L259-314)**: Returns capability negotiation with extensive feature flags
- **handleLaunch() (L326-397)**: Simulates program launch with `stopOnEntry` support and automatic breakpoint hitting
- **handleSetBreakpoints() (L399-426)**: Stores breakpoints and returns verified status
- **handleStackTrace() (L441-476)**: Returns mock stack frames (`main.mock`, `lib.mock`)
- **handleScopes() (L478-513)**: Provides "Locals" and "Globals" variable scopes
- **handleVariables() (L515-539)**: Returns variables for given scope reference
- **handleContinue() (L541-603)**: Simulates execution with breakpoint detection logic
- **handleNext/StepIn/StepOut() (L605-674)**: Step operations with immediate stopped events
- **handlePause() (L676-697)**: Immediate pause simulation
- **handleDisconnect/Terminate() (L699-731)**: Cleanup and process exit

#### Variable Management (L763-767)
- **getOrCreateVariableReference()**: Creates unique references for variable scopes
- **nextVariableReference (L101)**: Auto-incrementing reference counter starting at 1000

#### Mock Data Generation
- Provides realistic variable data (locals: x=10, y=20, result=30; globals: __name__, __file__)
- Simulates multi-frame stack traces with line numbers
- Implements breakpoint verification and hit simulation

## Dependencies
- `@vscode/debugprotocol`: DAP type definitions
- `net`: TCP server functionality
- `path`: File path operations
- `stream`: Stream abstractions

## Architectural Patterns
- Command pattern for DAP request handling with explicit handler methods
- State machine for debugging session lifecycle management  
- Transport abstraction supporting both stdio and TCP modes
- Asynchronous event simulation using setTimeout for realistic timing

## Critical Invariants
- All DAP responses include proper `seq`, `request_seq`, and `command` fields
- Variable references are unique and persistent within session
- Breakpoint simulation respects line number ordering
- Process exits cleanly on disconnect (stdio) but allows reconnection (TCP)

## Usage Context
Executable process (`#!/usr/bin/env node`) designed for spawning by debug clients or running as standalone TCP server. Logs operations to stderr to avoid protocol interference.