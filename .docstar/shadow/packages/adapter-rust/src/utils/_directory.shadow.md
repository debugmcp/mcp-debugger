# packages\adapter-rust\src\utils/
@children-hash: 5f0239e3cb9f8dd5
@generated: 2026-02-15T09:01:29Z

## Rust Adapter Utilities Module

This directory provides a comprehensive utilities package for Rust development environment support within the adapter-rust system. It serves as the foundational layer for Rust toolchain integration, binary analysis, debugging setup, and project management operations.

## Overall Purpose

The utils module abstracts Rust ecosystem complexity by providing high-level interfaces for:
- **Toolchain Detection**: Verifying Rust/Cargo installations and extracting version information
- **Project Management**: Discovering, parsing, building, and testing Cargo projects
- **Binary Analysis**: Examining compiled executables for format classification and debug information
- **Debug Environment Setup**: Resolving CodeLLDB debugger paths and configurations
- **Cross-Platform Operations**: Handling platform-specific file paths, executable extensions, and toolchain locations

## Key Components and Relationships

**`rust-utils.ts`** - Central orchestrator providing:
- Primary toolchain verification (`checkCargoInstallation`, `checkRustInstallation`)
- High-level project operations (`buildRustProject`, `findCargoProjectRoot`)
- Platform-specific binary path resolution (`getRustBinaryPath`)
- Windows-specific tool discovery (`findDlltoolExecutable`)

**`cargo-utils.ts`** - Cargo project specialist offering:
- Comprehensive project metadata extraction (`resolveCargoProject`, `getCargoTargets`)
- Intelligent build management with change detection (`needsRebuild`, `buildCargoProject`)
- Test execution wrapper (`runCargoTest`)
- Binary target resolution (`getDefaultBinary`, `findBinaryTargets`)

**`binary-detector.ts`** - Executable analysis engine providing:
- Binary format classification (MSVC/GNU/unknown) based on import signatures
- Debug information detection (PDB/DWARF/none)
- Import dependency scanning for toolchain identification

**`codelldb-resolver.ts`** - Debug environment configurator handling:
- Platform-aware CodeLLDB executable resolution with multiple fallback paths
- Version detection and management for debugger compatibility

## Public API Surface

### Primary Entry Points
- **Environment Setup**: `checkCargoInstallation()`, `checkRustInstallation()`, `resolveCodeLLDBExecutable()`
- **Project Discovery**: `findCargoProjectRoot()`, `resolveCargoProject()`
- **Build Operations**: `buildRustProject()`, `buildCargoProject()`, `runCargoTest()`
- **Binary Analysis**: `detectBinaryFormat()`, `getRustBinaryPath()`
- **Metadata Extraction**: `getCargoTargets()`, `getCargoVersion()`, `getCodeLLDBVersion()`

### Specialized Functions
- **Change Detection**: `needsRebuild()` for efficient incremental builds
- **Target Management**: `findBinaryTargets()`, `getDefaultBinary()`
- **Platform Support**: `getRustHostTriple()`, `findDlltoolExecutable()`

## Internal Organization and Data Flow

The module follows a layered architecture:

1. **Foundation Layer** (`rust-utils.ts`): Basic toolchain verification and path resolution
2. **Project Layer** (`cargo-utils.ts`): Cargo-specific operations and metadata handling
3. **Analysis Layer** (`binary-detector.ts`): Post-build executable inspection
4. **Debug Layer** (`codelldb-resolver.ts`): Debugging environment configuration

**Data Flow Patterns:**
- Project discovery → Metadata extraction → Build execution → Binary analysis → Debug setup
- Graceful error handling with null/false returns rather than exceptions
- Promise-based async operations throughout
- Child process spawning for all external tool interactions

## Important Patterns and Conventions

### Cross-Platform Compatibility
- Platform-specific executable extension handling (`.exe` on Windows)
- Shell-enabled process spawning for reliable command execution
- Architecture-aware path resolution for debugging tools

### Error Resilience
- Multiple fallback strategies for tool and path resolution
- Comprehensive try-catch blocks with graceful degradation
- Environment variable overrides for manual configuration

### Performance Optimizations
- Intelligent rebuild detection using file modification timestamps
- Limited binary scanning (first 1MB) for format detection
- Caching of resolved paths and metadata where appropriate

### Integration Patterns
- Consistent Promise-based APIs across all modules
- Standardized data structures (`CargoTarget`, `BinaryInfo`)
- Unified logging integration points for build operations

This utilities module serves as the critical infrastructure layer enabling the adapter-rust system to seamlessly interact with the Rust ecosystem while abstracting away platform-specific complexities and toolchain variations.