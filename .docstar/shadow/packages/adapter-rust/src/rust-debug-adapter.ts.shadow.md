# packages/adapter-rust/src/rust-debug-adapter.ts
@source-hash: 7de3c3f11cfe8704
@generated: 2026-02-10T00:41:39Z

## Purpose
Rust debug adapter implementation using CodeLLDB as the underlying debug engine. Provides language-specific debugging capabilities through a proxy-based architecture where ProxyManager handles process spawning and DAP communication.

## Architecture & Key Components

**RustDebugAdapter Class (L98-1170)**
- Extends EventEmitter, implements IDebugAdapter interface
- Core state machine with AdapterState transitions
- Manages lifecycle: UNINITIALIZED → INITIALIZING → READY → CONNECTED → DEBUGGING
- Caches executable paths with 60-second TTL (L110-111)

## Core Functionality

**Environment Validation (L194-281)**
- Validates CodeLLDB executable availability via `resolveCodeLLDBExecutable()`
- Checks Rust/Cargo toolchain installation
- Detects MSVC vs GNU toolchain configurations
- Handles Windows-specific dlltool requirements for GNU builds

**Executable Resolution (L308-394)**
- Caches resolved paths with timestamp validation
- Supports relaxed mode for containerized environments via `MCP_RUST_ALLOW_PREBUILT`
- Fallback chain: user-specified → cargo → rustc → relaxed mode placeholder

**Toolchain Compatibility (L582-652)**
- Binary format detection via `detectBinaryFormat()` utility
- MSVC toolchain validation with configurable behavior (warn/error/continue)
- Stores validation results in `lastToolchainValidation` for consumption

**CodeLLDB Command Building (L656-725)**
- Resolves CodeLLDB path synchronously using platform-specific detection
- Builds TCP-mode command with `--port` argument
- Configures embedded Python environment for LLDB visualizers
- Sets LLDB_USE_NATIVE_PDB_READER=1 on Windows

## Configuration & Launch

**RustLaunchConfig Interface (L74-93)**
- Extends LanguageSpecificLaunchConfig with Rust-specific options
- Cargo build configuration (bin/example/test targets, features, release mode)
- LLDB command customization (init/preRun/postRun commands)
- Source mapping support for std library debugging

**Launch Config Transformation (L787-917)**
- Resolves source files (.rs) to compiled binaries
- Integrates with Cargo project detection and building
- Sets `sourceLanguages: ['rust']` for proper CodeLLDB formatting
- Validates toolchain compatibility before launch

## Dependencies & Utilities

**External Modules**
- `./utils/codelldb-resolver.js` - CodeLLDB executable location (L41)
- `./utils/rust-utils.js` - Rust toolchain validation (L43-47)
- `./utils/binary-detector.js` - Binary format analysis (L48)
- `./utils/cargo-utils.js` - Dynamic import for project management (L826-827)

**Key Interfaces**
- `ToolchainValidationResult` (L52-59) - MSVC/GNU compatibility status
- `ExecutablePathCacheEntry` (L64-69) - Path caching with metadata
- `MsvcBehavior` type (L50) - Configurable MSVC handling strategy

## State Management

**Connection Lifecycle**
- `connect()` (L987-995) - Sets connected state, transitions to CONNECTED
- `disconnect()` (L997-1002) - Cleans up state, transitions to DISCONNECTED
- Thread tracking via `currentThreadId` updated on DAP 'stopped' events (L959-961)

**Error Handling**
- Comprehensive error translation for common Rust/CodeLLDB issues (L1052-1076)
- Installation guidance for platform-specific requirements (L1010-1038)
- AdapterError wrapping with specific error codes

## Debug Protocol Integration

**DAP Operations (L930-984)**
- Request validation for Rust/LLDB-specific commands
- Exception breakpoint filtering (rust_panic, cpp_throw, cpp_catch)
- Event handling for state transitions and thread management

**Capabilities (L1130-1169)**
- Full CodeLLDB feature support including conditional breakpoints, data breakpoints
- LLDB-specific limitations (no reverse debugging, no exception info for panics)
- Instruction-level debugging and disassembly support

## Platform Considerations

**Windows-Specific (L693-708)**
- Native PDB reader configuration for MSVC binaries  
- dlltool.exe path management for GNU toolchain
- Path sanitization for CodeLLDB executables with spaces (L512-553)

**Cross-Platform Path Resolution**
- Platform-aware CodeLLDB executable detection (L727-775)
- Rust toolchain path discovery with RUSTUP_HOME/CARGO_HOME support (L396-431)