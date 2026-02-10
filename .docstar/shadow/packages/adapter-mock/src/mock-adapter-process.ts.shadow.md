# packages/adapter-mock/src/mock-adapter-process.ts
@source-hash: 478c902562832db2
@generated: 2026-02-09T18:14:41Z

**Mock Debug Adapter Process** - Implements a complete DAP (Debug Adapter Protocol) server simulation for testing VS Code debugging integrations.

## Core Architecture

**DAPConnection (L16-86)**: Low-level DAP protocol handler managing message framing and JSON serialization. Implements the DAP wire protocol with Content-Length headers and handles message buffering for both stdin/stdout and TCP socket communication. Key methods:
- `start()` (L24): Begins listening for incoming data chunks
- `processMessages()` (L50-79): Parses DAP protocol messages with proper Content-Length framing
- `sendMessage()` (L81-85): Formats and sends DAP protocol messages

**MockDebugAdapterProcess (L95-768)**: Main DAP server implementation providing full debugging session simulation. Maintains debugging state including breakpoints, variables, execution context, and thread information.

## Key State Management

- `breakpoints`: Map<string, DebugProtocol.Breakpoint[]> (L99) - Tracks breakpoints by file path
- `variableHandles`: Map<number, VariableData> (L100) - Associates variable references with scope data
- `currentLine`: number (L102) - Simulates current execution position
- `isRunning`: boolean (L103) - Tracks program execution state
- `threads`: Array (L104) - Static thread list with single main thread

## Protocol Command Handlers

**Initialization Sequence**:
- `handleInitialize()` (L259-314): Returns comprehensive capability flags and sends 'initialized' event
- `handleConfigurationDone()` (L316-324): Completes setup phase
- `handleLaunch()` (L326-397): Starts debug session, handles stopOnEntry behavior

**Breakpoint Management**:
- `handleSetBreakpoints()` (L399-426): Stores breakpoints with auto-generated IDs and verification

**Execution Control**:
- `handleContinue()` (L541-603): Simulates program execution, finds next breakpoint or terminates
- `handleNext()` (L605-628): Steps to next line with line counter increment
- `handleStepIn/StepOut()` (L630-674): Step operations with immediate stop events
- `handlePause()` (L676-697): Interrupts execution

**Inspection Commands**:
- `handleStackTrace()` (L441-476): Returns mock stack with main.mock and lib.mock frames
- `handleScopes()` (L478-513): Provides "Locals" and "Globals" variable scopes
- `handleVariables()` (L515-539): Resolves variable references to actual values

## Communication Modes

Supports both stdio and TCP server modes based on command-line arguments:
- **Stdio Mode** (L138-141): Direct stdin/stdout communication for process-based debugging
- **TCP Mode** (L144-171): Network server allowing remote debugger connections with reconnection support

## Mock Behavior Patterns

- **Breakpoint Simulation**: Automatically stops at first breakpoint after launch or finds next breakpoint during continue operations
- **Variable Data**: Provides realistic local variables (x, y, result) and global variables (__name__, __file__)
- **Program Termination**: Sends proper terminated/exited event sequence when no more breakpoints exist
- **Timing Simulation**: Uses setTimeout delays (50-200ms) to simulate realistic debugging response times

## Dependencies

- `@vscode/debugprotocol`: Core DAP type definitions
- `net`: TCP server functionality for remote debugging
- `stream`: Readable/Writable interfaces for I/O abstraction

The process serves as a complete DAP server replacement for testing debugger clients without requiring actual runtime environments.