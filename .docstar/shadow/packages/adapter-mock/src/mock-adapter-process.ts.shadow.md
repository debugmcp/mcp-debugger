# packages/adapter-mock/src/mock-adapter-process.ts
@source-hash: af712d113d12d66d
@generated: 2026-02-11T16:12:56Z

This file implements a mock Debug Adapter Protocol (DAP) server for testing purposes. It can communicate via stdin/stdout or TCP, simulating a complete debugging session with breakpoints, stepping, and variable inspection.

## Architecture & Core Components

**DAPConnection (L16-86)**: Lightweight DAP protocol implementation handling message parsing and transport
- Manages buffered message parsing with Content-Length headers (L50-78)
- Supports both stdio and TCP socket communication
- Provides event-driven interface for requests and disconnections

**MockDebugAdapterProcess (L95-787)**: Main mock debug server implementation
- Command-line argument parsing for TCP mode (--port, --host, --session) (L107-128)
- Maintains debug session state: breakpoints, variables, execution position (L98-104)
- Comprehensive DAP request handler with 16 supported commands (L190-260)

## Key Protocol Handlers

**Session Management**:
- `handleInitialize` (L263-318): Returns full capability set, sends initialized event
- `handleLaunch` (L330-401): Supports stopOnEntry, simulates breakpoint execution
- `handleConfigurationDone` (L320-328): Completes initialization handshake

**Execution Control**:
- `handleContinue` (L560-622): Finds next breakpoint or terminates program
- `handleNext/StepIn/StepOut` (L624-693): Step operations with simulated delays
- `handlePause` (L695-716): Immediate pause with stopped event

**Debug Information**:
- `handleSetBreakpoints` (L403-430): Stores breakpoints per file path
- `handleStackTrace` (L445-480): Returns mock stack with main.mock and lib.mock frames
- `handleScopes/Variables` (L482-543): Provides locals/globals with sample data

## State Management

**Variable System**: Uses reference-based handles (L782-786) for nested variable access
- Locals: x=10, y=20, result=30 (sample integers)
- Globals: __name__, __file__ (sample strings)

**Execution State**: Tracks current line number and running status for realistic step behavior
- Breakpoint navigation logic finds next breakpoint by line number (L576-587)
- Automatic program termination when no more breakpoints exist

## Communication Modes

**Stdio Mode**: Default, uses process.stdin/stdout for DAP communication
**TCP Mode**: Creates server on specified host:port, allows reconnections (L144-171)

## Dependencies
- `@vscode/debugprotocol`: DAP type definitions
- Node.js built-ins: `net`, `path`, `stream`

## Usage Patterns
Designed for integration testing of DAP clients. Simulates realistic debugging scenarios with configurable breakpoint behavior and variable inspection. All responses include proper DAP message formatting with Content-Length headers.