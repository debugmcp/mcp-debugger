# packages/adapter-rust/src/rust-debug-adapter.ts
@source-hash: 7de3c3f11cfe8704
@generated: 2026-02-09T18:14:44Z

## RustDebugAdapter - Rust Language Debug Adapter

**Purpose**: Implements CodeLLDB-based Rust debugging support within the debug-mcp architecture. Acts as a proxy-managed adapter that validates Rust environments, manages toolchain compatibility (especially MSVC vs GNU), and translates generic debug configurations to CodeLLDB-specific launch parameters.

### Core Architecture

**Main Class**: `RustDebugAdapter` (L98-1170)
- Extends EventEmitter, implements IDebugAdapter interface
- Manages state transitions: UNINITIALIZED → INITIALIZING → READY → CONNECTED/DEBUGGING
- Language: `DebugLanguage.RUST`, uses CodeLLDB as underlying debugger

**Key Dependencies**:
- CodeLLDB executable resolution via `resolveCodeLLDBExecutable()` (L41)
- Rust toolchain utilities: `checkRustInstallation`, `checkCargoInstallation`, `getRustHostTriple` (L43-46)
- Binary format detection for MSVC/GNU compatibility (L48)

### Critical Features

**Toolchain Validation** (L582-634):
- `validateToolchain()`: Detects MSVC vs GNU compiled binaries
- MSVC toolchain warning system with configurable behavior (warn/error/continue)
- Auto-suggests GNU toolchain for better debugging experience
- Caches validation results via `lastToolchainValidation`

**Environment Validation** (L194-281):
- Validates CodeLLDB, Rust, Cargo installations
- Windows-specific dlltool detection for GNU builds
- MSVC runtime checks for Windows debugging

**Configuration Management**:
- `transformLaunchConfig()` (L787-917): Converts generic configs to CodeLLDB format
- Handles Cargo-based builds, source file resolution, binary path detection
- `RustLaunchConfig` interface (L74-93): Extends with Rust-specific options

### State Management

**Caching System** (L110-111):
- `executablePathCache`: Maps executable paths with timestamps
- 60-second cache timeout for performance optimization

**Connection Lifecycle** (L987-1006):
- TCP-based connection to CodeLLDB adapter
- State tracking: connected/disconnected status
- Thread ID management for debugging sessions

### Platform Adaptations

**Windows-Specific Handling**:
- Path sanitization for spaces in CodeLLDB paths (L512-553)
- Native PDB reader configuration (L694-708)
- dlltool integration for GNU builds
- Python environment configuration for CodeLLDB (L464-510)

**CodeLLDB Command Building** (L656-725):
- TCP port configuration for proxy architecture
- liblldb path resolution for Python visualizers
- Environment variable management (RUST_BACKTRACE, LLDB_USE_NATIVE_PDB_READER)

### Error Handling & User Guidance

**Error Translation** (L1052-1076):
- Translates technical errors to user-actionable messages
- Provides installation instructions and troubleshooting steps

**Installation Instructions** (L1010-1038):
- Platform-specific Rust installation guidance
- CodeLLDB setup instructions
- System requirement verification

### Feature Support Matrix

**Supported Features** (L1080-1096):
- Conditional/function/data breakpoints
- Variable inspection and modification
- Log points, disassembly, step-in targets
- Memory inspection (via LLDB capabilities)

**Capabilities** (L1130-1169):
- Comprehensive DAP feature support through CodeLLDB
- Rust-specific adaptations (sourceLanguages: ['rust'])
- Exception handling adapted for Rust panics vs C++ exceptions

### Critical Patterns

**Relaxed Toolchain Mode** (L366-390):
- Container/prebuilt binary support via environment variables
- Fallback mechanisms for environments without full Rust toolchain

**Binary Resolution** (L816-870):
- Smart resolution from .rs source files to compiled binaries
- Cargo project detection and build management
- Automatic rebuild detection and execution