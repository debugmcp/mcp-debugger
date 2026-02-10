# src/proxy/dap-proxy-message-parser.ts
@source-hash: 72c8990a75811483
@generated: 2026-02-09T18:15:05Z

## Primary Purpose
Provides pure message parsing and validation utilities for DAP (Debug Adapter Protocol) Proxy inter-process communication. Handles JSON message parsing from string/object formats and validates command payloads with comprehensive error handling.

## Core Architecture
**MessageParser class (L13-167)** - Static utility class implementing command routing and payload validation
- **parseCommand()** (L18-53): Main entry point that handles JSON parsing and routes to command-specific validators
- **validateInitPayload()** (L59-117): Validates initialization commands with complex nested validation
- **validateDapPayload()** (L123-142): Validates DAP protocol commands  
- **validateTerminatePayload()** (L148-158): Validates termination commands (sessionId optional)
- **isStringMessage()** (L163-165): Type guard utility for string detection

## Key Dependencies
- **dap-proxy-interfaces.js** (L6-11): Imports ParentCommand, ProxyInitPayload, DapCommandPayload, TerminatePayload types

## Validation Patterns
- **Two-phase parsing**: String messages parsed as JSON then recursively validated (L20-27)
- **Command routing**: Switch-based dispatch on 'cmd' field (L43-52)
- **Field validation loops**: Iterative validation of required string fields (L63-71, L127-133)
- **Optional field handling**: Conditional validation for undefined vs invalid values
- **Type assertions**: Uses `as unknown as T` pattern for TypeScript compliance (L116, L141, L157)

## Critical Validation Rules
- **Init payload**: Requires sessionId, executablePath, adapterHost, logDir, scriptPath (strings) + adapterPort (1-65535)
- **Breakpoint validation** (L96-113): File/line required, condition optional
- **DAP payload**: Requires sessionId, requestId, dapCommand; dapArgs forbidden as null
- **Terminate payload**: sessionId completely optional for emergency shutdown capability
- **Port validation**: adapterPort must be positive integer ≤ 65535 (L74-76)

## Error Handling Strategy
Comprehensive error messages with context information, immediate throwing on validation failures. All validation methods designed to fail fast with descriptive error messages including actual values received.