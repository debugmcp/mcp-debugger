# packages\adapter-rust\src\utils/
@generated: 2026-02-12T21:05:49Z

## Rust Development Environment Utilities

This directory provides comprehensive utility functions for managing Rust development environments within the adapter-rust package. It serves as the foundational layer for Rust toolchain integration, binary analysis, project management, and debugging infrastructure.

## Overall Purpose

The utils module abstracts away the complexity of Rust/Cargo toolchain interactions, providing a unified interface for:
- Rust toolchain installation verification and version detection
- Cargo project discovery, building, and metadata extraction
- Binary format analysis and debug information detection
- CodeLLDB debugger integration and executable resolution

## Key Components & Integration

### Core Toolchain Management
- **rust-utils.ts**: Primary toolchain interface providing installation checks (`checkCargoInstallation`, `checkRustInstallation`), version detection, and build orchestration
- **cargo-utils.ts**: Specialized Cargo project management with metadata extraction, target discovery, and intelligent rebuild detection

### Binary Analysis Pipeline
- **binary-detector.ts**: Post-build binary analysis determining compiler toolchain (MSVC/GNU), debug format (PDB/DWARF), and dependency imports
- Integration with cargo-utils for complete build-to-analysis workflow

### Debug Infrastructure
- **codelldb-resolver.ts**: Platform-specific CodeLLDB debugger executable resolution with multi-path fallback strategies
- **rust-utils.ts**: Re-exports CodeLLDB resolver and provides Windows dlltool discovery for debugging workflows

## Public API Surface

### Primary Entry Points

**Toolchain Verification:**
- `checkCargoInstallation()` → `Promise<boolean>`
- `checkRustInstallation()` → `Promise<boolean>`
- `getCargoVersion()` → `Promise<string | null>`

**Project Management:**
- `resolveCargoProject(projectPath)` → `Promise<CargoProject | null>`
- `findCargoProjectRoot(startPath)` → `Promise<string | null>`
- `buildCargoProject(projectRoot, logger?, buildMode?)` → `Promise<string | null>`

**Binary Analysis:**
- `detectBinaryFormat(binaryPath)` → `Promise<BinaryInfo>`
- `needsRebuild(projectPath, binaryName, release?)` → `Promise<boolean>`

**Debug Support:**
- `resolveCodeLLDBExecutable()` → `Promise<string | null>`
- `getCodeLLDBVersion()` → `Promise<string | null>`

## Internal Organization & Data Flow

### Project Discovery → Build → Analysis Pipeline
1. **Discovery**: `findCargoProjectRoot()` locates project, `resolveCargoProject()` extracts metadata
2. **Build Decision**: `needsRebuild()` compares source/binary timestamps
3. **Compilation**: `buildCargoProject()` or `runCargoBuild()` executes cargo
4. **Analysis**: `detectBinaryFormat()` analyzes output binary for debugging setup

### Cross-Platform Abstraction
- Platform-specific executable extensions (.exe on Windows)
- Multi-architecture CodeLLDB resolution (arm64/x64, darwin/linux/win32)
- Windows-specific toolchain discovery (dlltool, rustup directories)

## Important Patterns & Conventions

### Error Handling Strategy
- **Graceful degradation**: Functions return `null`/`false`/empty arrays instead of throwing
- **Try-catch wrapping**: All spawn operations and file I/O wrapped with error handling
- **Fallback chains**: Multiple resolution strategies (environment vars, multiple search paths)

### Async Operation Patterns
- **Promise-wrapped spawns**: Child process execution wrapped in Promise constructors
- **File system async**: Consistent use of fs/promises for non-blocking I/O
- **Shell compatibility**: `shell: true` for cross-platform command execution

### Performance Optimizations
- **Selective binary scanning**: Limited to first 1MB for binary format detection
- **Intelligent rebuild**: mtime-based change detection avoiding unnecessary compilation
- **Lazy resolution**: Toolchain checks only when needed

### Data Structures
- **CargoTarget**: Standardized representation of compilation targets
- **BinaryInfo**: Comprehensive binary analysis results with format/debug/imports
- **CargoProject**: Project metadata combining TOML parsing with cargo metadata

This utility collection provides a robust, cross-platform foundation for Rust development tool integration, emphasizing reliability, performance, and comprehensive toolchain support.