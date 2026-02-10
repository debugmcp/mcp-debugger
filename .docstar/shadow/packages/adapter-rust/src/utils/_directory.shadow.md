# packages/adapter-rust/src/utils/
@generated: 2026-02-10T21:26:24Z

## Purpose

The `packages/adapter-rust/src/utils` directory provides comprehensive Rust development environment management utilities for a debug adapter. It serves as the foundational layer for Rust/Cargo project detection, binary analysis, toolchain verification, and debugger integration, enabling the adapter to work seamlessly across different platforms and Rust development configurations.

## Key Components and Architecture

The directory contains four specialized utility modules that work together to provide complete Rust project lifecycle support:

### Core Project Management (`cargo-utils.ts`)
- **Primary Entry Points**: `resolveCargoProject()`, `buildCargoProject()`, `findCargoProjectRoot()`
- **Responsibilities**: Cargo project discovery, metadata extraction, compilation target management, and intelligent rebuild detection
- **Key Features**: Cargo.toml parsing, target enumeration via `cargo metadata`, build orchestration, and change detection

### Environment Verification (`rust-utils.ts`)  
- **Primary Entry Points**: `checkCargoInstallation()`, `checkRustInstallation()`, `getRustHostTriple()`
- **Responsibilities**: Rust toolchain availability verification, version detection, and platform-specific tool resolution
- **Key Features**: Cargo/rustc presence validation, host triple detection, and Windows dlltool resolution

### Binary Analysis (`binary-detector.ts`)
- **Primary Entry Points**: `detectBinaryFormat()`
- **Responsibilities**: Executable format analysis for Rust binaries, determining compiler toolchain and debug information
- **Key Features**: MSVC vs GNU detection, PDB/DWARF debug format identification, and import dependency analysis

### Debugger Integration (`codelldb-resolver.ts`)
- **Primary Entry Points**: `resolveCodeLLDBExecutable()`, `getCodeLLDBVersion()`
- **Responsibilities**: Platform-specific CodeLLDB debugger resolution and version management
- **Key Features**: Multi-platform executable discovery, version detection, and fallback path resolution

## Public API Surface

The module provides these primary interfaces for adapter consumption:

**Project Management:**
- `resolveCargoProject(projectPath)` - Complete project analysis and metadata extraction
- `buildCargoProject(projectRoot, logger?, buildMode?)` - High-level build orchestration
- `findCargoProjectRoot(filePath)` - Project root discovery from any file path

**Environment Validation:**
- `checkCargoInstallation()` / `checkRustInstallation()` - Toolchain availability checks
- `getRustHostTriple()` - Platform identification for target-specific operations

**Binary Analysis:**
- `detectBinaryFormat(filePath)` - Comprehensive executable format detection

**Debugger Support:**
- `resolveCodeLLDBExecutable()` - Debugger executable resolution across platforms

## Internal Organization and Data Flow

The utilities follow a layered architecture with clear separation of concerns:

1. **Detection Layer**: `rust-utils.ts` validates environment prerequisites
2. **Project Layer**: `cargo-utils.ts` handles project structure and build operations  
3. **Analysis Layer**: `binary-detector.ts` examines compiled artifacts
4. **Debug Layer**: `codelldb-resolver.ts` provides debugger integration

**Typical Data Flow:**
1. Environment validation (rust-utils) → 2. Project discovery (cargo-utils) → 3. Build execution (cargo-utils) → 4. Binary analysis (binary-detector) → 5. Debug setup (codelldb-resolver)

## Important Patterns and Conventions

**Error Handling**: All modules use graceful error handling, returning null/false/empty arrays rather than throwing exceptions, ensuring adapter stability.

**Cross-Platform Compatibility**: Extensive platform-aware logic handles Windows executable extensions, macOS architectures, and Linux variations transparently.

**Process Spawning**: Consistent use of `child_process.spawn` with `shell: true` for reliable cross-platform command execution.

**Filesystem-First Approach**: Prioritizes filesystem checks and metadata parsing over command execution for performance and reliability.

**Multi-Path Resolution**: Robust fallback mechanisms for tool and binary discovery across different deployment scenarios (production, development, monorepo).

**Async-First Design**: All operations are Promise-based with proper async/await patterns for non-blocking adapter operation.