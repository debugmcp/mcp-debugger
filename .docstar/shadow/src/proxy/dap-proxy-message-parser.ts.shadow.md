# src/proxy/dap-proxy-message-parser.ts
@source-hash: 72c8990a75811483
@generated: 2026-02-10T00:41:52Z

## Primary Purpose
Message parsing and validation utilities for DAP (Debug Adapter Protocol) Proxy. Provides pure functions with no side effects for parsing IPC messages from parent processes into typed command objects.

## Key Classes and Functions

### MessageParser (L13-167)
Static utility class handling all message parsing operations.

**parseCommand (L18-53)**: Main entry point for parsing parent process messages. Accepts `unknown` input, handles JSON string parsing recursively, validates object structure, and routes to specific validators based on `cmd` field. Returns typed `ParentCommand` union type.

**validateInitPayload (L59-117)**: Validates initialization commands with comprehensive field validation:
- Required strings: sessionId, executablePath, adapterHost, logDir, scriptPath (L63-71)
- Required number: adapterPort with range validation 1-65535 (L74-76)
- Optional arrays: scriptArgs, initialBreakpoints with nested validation (L79-113)
- Optional booleans: stopOnEntry, justMyCode, dryRunSpawn (L83-93)

**validateDapPayload (L123-142)**: Validates DAP command messages requiring sessionId, requestId, and dapCommand as strings. Optional dapArgs field with null-check validation (L136-138).

**validateTerminatePayload (L148-158)**: Validates termination commands where sessionId is optional for emergency shutdown scenarios (L152-154).

**isStringMessage (L163-165)**: Type guard utility for detecting string messages requiring JSON parsing.

## Dependencies
- Imports command interfaces from `./dap-proxy-interfaces.js` (L6-11)
- Uses ParentCommand, ProxyInitPayload, DapCommandPayload, TerminatePayload types

## Architectural Patterns
- Static class design with pure functions for testability
- Recursive parsing pattern for string messages (L23)
- Command routing via switch statement (L43-52)
- Comprehensive validation with detailed error messages
- Type assertions via `unknown` intermediate type for TypeScript compliance (L116, L141, L157)

## Critical Invariants
- All validation methods throw Error on invalid input
- Port numbers must be in valid range 1-65535
- Breakpoints require both file (string) and line (number) properties
- sessionId optional only for terminate commands
- dapArgs cannot be explicitly null (undefined allowed)