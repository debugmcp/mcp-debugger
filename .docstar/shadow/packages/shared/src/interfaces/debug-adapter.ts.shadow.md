# packages/shared/src/interfaces/debug-adapter.ts
@source-hash: fa223fea8b483960
@generated: 2026-02-10T00:41:24Z

## Primary Purpose

This file defines the core interface contract (`IDebugAdapter`) for multi-language debugging support, abstracting the Debug Adapter Protocol (DAP) operations while enabling language-specific implementations. It serves as the foundational abstraction layer for a debugging system that supports multiple programming languages through a unified interface.

## Key Interface and Core Methods

**IDebugAdapter (L24-225)** - Main interface extending EventEmitter that all language-specific debug adapters must implement:

### Lifecycle Management
- `initialize()` (L33) - Initialize adapter and validate environment  
- `dispose()` (L38) - Clean up resources and connections
- `getState()` (L45) - Return current adapter state from AdapterState enum
- `isReady()` (L50) - Check if adapter is ready for debugging

### Environment and Executable Management
- `validateEnvironment()` (L62) - Async validation returning ValidationResult
- `resolveExecutablePath()` (L75) - Resolve language executable path with optional user preference
- `getDefaultExecutableName()` (L81) - Get platform executable name (e.g., 'python', 'node')
- `getExecutableSearchPaths()` (L86) - Platform-specific search paths

### Configuration Transformation
- `transformLaunchConfig()` (L121) - **Async since v2.1.0** - Transform generic to language-specific launch config (supports build operations like Rust compilation)
- `transformAttachConfig()` (L146) - Transform generic to language-specific attach config (optional)
- `buildAdapterCommand()` (L93) - Build command to launch debug adapter

### DAP Protocol Operations
- `sendDapRequest<T>()` (L160-163) - Send DAP request with typed response
- `handleDapEvent()` (L168) - Handle incoming DAP events
- `handleDapResponse()` (L173) - Handle incoming DAP responses

### Connection Management
- `connect()` (L180) - Connect to debug adapter with host/port
- `disconnect()` (L185) - Disconnect from adapter
- `isConnected()` (L190) - Check connection status

### Feature Support
- `supportsFeature()` (L214) - Check if specific DebugFeature is supported
- `getCapabilities()` (L224) - Return full AdapterCapabilities declaration

## Supporting Type Definitions

**AdapterState enum (L232-240)** - Lifecycle states: UNINITIALIZED → INITIALIZING → READY → CONNECTED → DEBUGGING → DISCONNECTED → ERROR

**ValidationResult (L245-249)** - Environment validation with errors/warnings arrays

**AdapterConfig (L290-299)** - Configuration for adapter launch including sessionId, paths, and launch config

**GenericLaunchConfig (L304-311)** - Language-agnostic launch configuration with common options (stopOnEntry, justMyCode, env, cwd, args)

**LanguageSpecificLaunchConfig (L316-319)** - Extends generic config with language-specific properties

**DebugFeature enum (L325-346)** - Comprehensive DAP feature enumeration (conditional breakpoints, variable paging, step back, etc.)

**AdapterCapabilities (L360-400)** - Mirrors DAP capabilities specification with detailed feature support flags

## Error Handling

**AdapterError class (L419-428)** - Base error with code and recoverability flag

**AdapterErrorCode enum (L433-456)** - Categorized error codes: environment, connection, protocol, runtime, and generic errors

## Event System

**AdapterEvents interface (L463-482)** - Comprehensive event definitions including DAP events (stopped, continued, terminated) and adapter lifecycle events (initialized, connected, stateChanged)

## Key Dependencies

- `@vscode/debugprotocol` (L17) - DAP specification types
- `../models/index.js` (L18) - DebugLanguage and configuration types  
- `./adapter-launch-barrier.js` (L19) - Optional launch coordination

## Architectural Decisions

- **Event-driven architecture** using EventEmitter for state changes and DAP events
- **Async-first design** with Promise-based operations for all I/O
- **Language-agnostic core** with language-specific extensions through inheritance
- **Performance constraint** of < 5ms per operation (L12)
- **Optional attach/detach support** through optional methods (L132, L137)
- **Migration support** through ConfigMigration interface (L489-499) for backward compatibility

## Critical Constraints

- All DAP operations must be non-blocking and async
- Adapters must emit state change events for proper lifecycle management
- Environment validation is mandatory before debugging operations
- Feature support must be declared through capabilities for proper client negotiation