# packages/adapter-rust/src/utils/
@generated: 2026-02-11T23:47:41Z

## Rust Development Utilities Module

This directory provides comprehensive utilities for Rust development environment management, project analysis, and debugging support within the adapter-rust package. It serves as the foundational layer for Rust toolchain integration, offering standardized interfaces for Cargo operations, binary analysis, and debug tooling.

## Core Responsibilities

- **Rust Toolchain Management**: Installation verification, version detection, and environment validation for Rust/Cargo
- **Project Discovery & Operations**: Cargo.toml parsing, project structure analysis, building, and testing
- **Binary Analysis**: Executable format detection, debug information classification, and dependency analysis
- **Debug Tool Integration**: CodeLLDB debugger resolution and version management
- **Cross-platform Compatibility**: Windows, macOS, and Linux support with platform-specific handling

## Key Components & Integration

### Primary Entry Points

**rust-utils.ts** - Main API surface providing:
- Installation checks (`checkCargoInstallation()`, `checkRustInstallation()`)
- Project root discovery (`findCargoProjectRoot()`)
- Build operations (`buildRustProject()`)
- Binary path resolution (`getRustBinaryPath()`)
- Host triple detection (`getRustHostTriple()`)
- Windows toolchain support (`findDlltoolExecutable()`)

**cargo-utils.ts** - Cargo-specific operations:
- Project metadata resolution (`resolveCargoProject()`, `getCargoTargets()`)
- Intelligent rebuild detection (`needsRebuild()`)
- Test execution (`runCargoTest()`)
- High-level build orchestration (`buildCargoProject()`)

**binary-detector.ts** - Executable analysis:
- Binary format classification (`detectBinaryFormat()`)
- Debug information detection (PDB/DWARF)
- Import dependency scanning
- Toolchain identification (MSVC vs GNU)

**codelldb-resolver.ts** - Debug tooling:
- Platform-specific CodeLLDB executable resolution
- Version management and fallback handling
- Multi-path search strategy for various deployment scenarios

## Data Flow & Architecture

1. **Environment Validation**: rust-utils performs initial toolchain checks
2. **Project Discovery**: cargo-utils locates and analyzes Cargo projects
3. **Build Orchestration**: Combines rebuild detection, cargo execution, and binary resolution
4. **Debug Preparation**: codelldb-resolver provides debugger paths, binary-detector analyzes executables
5. **Cross-cutting Concerns**: All modules handle platform differences and graceful error recovery

## Common Patterns

- **Promise-based Async Operations**: All functions return Promises with spawn-wrapped cargo commands
- **Graceful Error Handling**: Return null/empty values instead of throwing exceptions
- **Platform Abstraction**: Windows .exe handling, path separators, and tool locations
- **Multi-fallback Resolution**: Environment variables, multiple search paths, and default values
- **Filesystem Monitoring**: mtime-based change detection for efficient rebuilds

## Public API Surface

The module primarily exports through rust-utils.ts, which re-exports codelldb-resolver functionality and provides the main interface for:
- Rust environment validation and setup
- Project root discovery and cargo operations
- Build execution and binary location
- Platform-specific tool resolution

Internal modules (cargo-utils, binary-detector) provide specialized functionality consumed by the main utilities and other adapter components requiring detailed Rust project introspection or executable analysis.

## Dependencies

- Node.js built-ins: child_process, fs/promises, path, os
- External: `which` for executable resolution
- No heavy external dependencies, focusing on CLI tool integration and filesystem operations