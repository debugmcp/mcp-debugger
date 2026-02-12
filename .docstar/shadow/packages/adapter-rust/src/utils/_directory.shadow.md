# packages\adapter-rust\src\utils/
@generated: 2026-02-12T21:00:56Z

## Rust Adapter Utilities Package

This utils directory provides a comprehensive suite of utilities for Rust development environment integration, serving as the foundational support layer for the adapter-rust package. The module collectively handles Rust toolchain detection, Cargo project management, binary analysis, and debugging infrastructure.

## Core Components and Responsibilities

### Toolchain and Environment Management
- **rust-utils.ts**: Primary entry point providing Rust/Cargo installation verification, version detection, and host triple resolution
- **codelldb-resolver.ts**: Platform-specific CodeLLDB debugger executable resolution with multi-path fallback strategies

### Project Management and Build Operations
- **cargo-utils.ts**: Comprehensive Cargo project lifecycle management including metadata extraction, target discovery, building, testing, and intelligent rebuild detection
- Integration with Cargo CLI through spawned processes for metadata queries and build operations

### Binary Analysis and Classification
- **binary-detector.ts**: Executable format analysis determining compiler toolchain (MSVC vs GNU), debug information presence (PDB/DWARF), and import dependencies

## Public API Surface

### Primary Entry Points
- `checkCargoInstallation()` / `checkRustInstallation()`: Environment validation
- `resolveCargoProject(projectPath)`: Project discovery and metadata extraction
- `buildCargoProject(projectRoot, logger?, buildMode?)`: High-level build orchestration
- `detectBinaryFormat(binaryPath)`: Binary analysis and classification
- `resolveCodeLLDBExecutable()`: Debug infrastructure setup

### Key Data Structures
- `CargoTarget`: Compilation target representation (name, kind, source path)
- `BinaryInfo`: Binary classification results (format, debug info, imports)

## Internal Organization and Data Flow

**Discovery → Analysis → Build → Debug Pipeline:**

1. **Environment Setup**: rust-utils validates Rust/Cargo installation and resolves toolchain details
2. **Project Discovery**: cargo-utils locates Cargo.toml, parses metadata, and identifies targets
3. **Build Management**: Intelligent rebuild detection, spawned cargo builds, and binary path resolution
4. **Binary Analysis**: Post-build executable classification for debugging strategy selection
5. **Debug Infrastructure**: Platform-aware CodeLLDB resolver for debug session initialization

## Important Patterns and Conventions

### Error Handling Strategy
- Graceful degradation with null/empty returns instead of exceptions
- Try-catch wrapping of all file system and spawn operations
- Multiple fallback mechanisms for tool and path resolution

### Cross-Platform Compatibility
- Platform-specific executable extensions (.exe on Windows)
- Shell-based spawn operations (`shell: true`)
- Architecture-aware binary distribution paths

### Performance Optimizations
- Intelligent rebuild detection using mtime comparisons
- Limited binary scanning (1MB max) for format detection
- Cached version lookups and path resolution

### Integration Architecture
- Heavy reliance on Cargo CLI integration rather than internal parsing
- Promise-based async operations throughout
- Modular composition allowing selective utility usage

## Dependencies and External Integrations

**Node.js Built-ins**: fs/promises, child_process, path, os, url
**External Tools**: cargo, rustc, CodeLLDB
**Optional**: which package for executable resolution

The module serves as the bridge between the adapter's high-level debugging functionality and the underlying Rust development ecosystem, providing reliable detection, build management, and platform abstraction.