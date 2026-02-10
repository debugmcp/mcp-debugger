# packages/shared/src/interfaces/debug-adapter.ts
@source-hash: fa223fea8b483960
@generated: 2026-02-09T18:14:18Z

## Core Debug Adapter Interface

**Primary Purpose:** Defines the contract for language-agnostic debug adapters that implement Debug Adapter Protocol (DAP) operations. This is the central abstraction that enables multi-language debugging support through a unified interface.

**Key Interface: IDebugAdapter (L24-225)**
- Extends EventEmitter for event-driven architecture
- Core properties: `language` (DebugLanguage), `name` (string)
- **Lifecycle Management (L28-38):** `initialize()`, `dispose()` for setup/cleanup
- **State Management (L40-55):** `getState()` → AdapterState, `isReady()`, `getCurrentThreadId()`
- **Environment Validation (L57-67):** `validateEnvironment()` → ValidationResult, `getRequiredDependencies()`
- **Executable Management (L69-86):** Path resolution with `resolveExecutablePath()`, platform-specific search paths
- **Adapter Configuration (L88-111):** Command building, module names, optional launch barriers via `createLaunchBarrier()`
- **Debug Configuration (L113-153):** Config transformation with async `transformLaunchConfig()` (async since v2.1.0 for build operations), optional attach support
- **DAP Protocol Operations (L155-173):** `sendDapRequest<T>()`, event/response handlers
- **Connection Management (L175-190):** Connect/disconnect with host/port, connection status
- **Error Handling (L192-207):** Installation instructions, error translation
- **Feature Support (L209-224):** Feature checking via `supportsFeature()`, capabilities declaration

**Supporting Enums and Types:**
- **AdapterState (L232-240):** State machine from UNINITIALIZED → ERROR
- **DebugFeature (L325-346):** DAP feature flags (conditional breakpoints, variable paging, etc.)
- **AdapterErrorCode (L433-456):** Categorized error codes for environment, connection, protocol, and runtime issues

**Key Configuration Types:**
- **GenericLaunchConfig (L304-311):** Language-agnostic debug settings
- **LanguageSpecificLaunchConfig (L316-319):** Extends generic with language-specific properties
- **AdapterConfig (L290-299):** Complete adapter setup including session ID, paths, ports
- **AdapterCapabilities (L360-400):** Mirrors DAP capabilities specification

**Error Handling:**
- **AdapterError class (L419-428):** Custom error with code and recoverability flag
- **ValidationResult (L245-249):** Environment validation with errors/warnings

**Event System:**
- **AdapterEvents (L463-482):** Type-safe event interface covering DAP events (stopped, continued, terminated) and adapter lifecycle events (initialized, connected, error, stateChanged)

**Dependencies:**
- @vscode/debugprotocol for DAP types
- ../models/index.js for DebugLanguage and config types
- ./adapter-launch-barrier.js for launch coordination

**Architectural Decisions:**
- Async-first design (all operations return Promises)
- Performance constraint: < 5ms per operation (L12)
- Event-driven state changes
- Language-agnostic abstraction over DAP
- Optional attach/detach support through feature flags
- Configuration migration support for backward compatibility