# packages/adapter-rust/src/utils/
@generated: 2026-02-10T01:19:45Z

## Rust Development Toolchain Utilities

This directory provides comprehensive utilities for Rust development environment management within the adapter-rust package. It serves as the foundation layer for Rust project discovery, toolchain validation, binary analysis, and debugging infrastructure setup.

## Core Purpose and Responsibility

The utils module abstracts the complexity of interacting with the Rust/Cargo ecosystem, providing high-level APIs for:
- Rust toolchain detection and validation (rustc, cargo, dlltool)
- Cargo project management (discovery, building, testing, metadata extraction)
- Binary format analysis and debug information detection
- CodeLLDB debugger integration and path resolution

## Key Components and Relationships

**Toolchain Management (`rust-utils.ts`)**
- Primary entry point for Rust environment validation
- Provides installation checks, version detection, and binary path resolution
- Serves as the foundation layer that other components depend on
- Re-exports CodeLLDB resolver for unified access

**Project Operations (`cargo-utils.ts`)**
- Builds on rust-utils foundation for project-specific operations
- Handles Cargo.toml parsing, target enumeration, and build orchestration
- Implements intelligent rebuild detection using file modification times
- Provides both low-level cargo command wrappers and high-level project management

**Binary Analysis (`binary-detector.ts`)**
- Analyzes compiled Rust binaries for toolchain classification (MSVC vs GNU)
- Detects debug information format (PDB vs DWARF) for debugging setup
- Scans import dependencies to determine runtime requirements
- Works in conjunction with cargo-utils build outputs

**Debug Infrastructure (`codelldb-resolver.ts`)**
- Resolves platform-specific CodeLLDB debugger paths across deployment scenarios
- Handles version detection and fallback mechanisms
- Supports both production installs and development environments

## Public API Surface

**Primary Entry Points:**
- `checkRustInstallation()` / `checkCargoInstallation()` - Environment validation
- `resolveCargoProject(projectPath)` - Project discovery and metadata
- `buildCargoProject(projectRoot, logger?, buildMode?)` - High-level build operations
- `detectBinaryFormat(binaryPath)` - Binary analysis and classification
- `resolveCodeLLDBExecutable()` - Debugger setup and integration

**Supporting Functions:**
- `findCargoProjectRoot(startPath)` - Project root discovery
- `needsRebuild()` - Intelligent build optimization
- `runCargoTest()` - Test execution wrapper
- `getRustBinaryPath()` - Binary location resolution with platform handling

## Internal Organization and Data Flow

1. **Environment Setup**: rust-utils validates Rust/Cargo availability
2. **Project Discovery**: cargo-utils locates and parses project structure
3. **Build Operations**: Coordinated cargo command execution with progress tracking
4. **Binary Analysis**: Post-build analysis determines debug configuration
5. **Debug Setup**: CodeLLDB resolution enables debugging capabilities

## Important Patterns and Conventions

**Error Handling Strategy**: Graceful degradation with null/false returns rather than exceptions, enabling robust fallback chains across the adapter.

**Cross-Platform Compatibility**: Consistent handling of Windows executable extensions, path separators, and platform-specific toolchain locations.

**Command Execution Pattern**: Promise-wrapped child_process.spawn operations with shell:true for reliability, capturing both stdout/stderr for comprehensive output.

**File System Monitoring**: Modification time-based rebuild detection minimizes unnecessary compilation cycles.

**Multi-Path Resolution**: Robust search strategies with fallbacks handle various deployment scenarios (development, production, monorepo).

**Platform Abstraction**: Encapsulates platform-specific differences in toolchain layout and executable naming conventions.

This module serves as the critical infrastructure layer that enables the rust-adapter to seamlessly integrate with the Rust development ecosystem across different platforms and deployment configurations.