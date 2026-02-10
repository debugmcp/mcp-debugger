# packages/adapter-rust/src/utils/cargo-utils.ts
@source-hash: 0bfd359c192a062d
@generated: 2026-02-09T18:14:13Z

## cargo-utils.ts - Cargo Project Management Utilities

**Primary Purpose**: Provides comprehensive utilities for interacting with Rust Cargo projects, including metadata parsing, building, testing, and dependency analysis. Part of a Rust adapter package for language tooling integration.

### Core Types and Interfaces

**CargoTarget (L12-16)**: Interface defining Cargo build targets with name, kind array (bin, lib, test, etc.), and source path.

### Project Analysis Functions

**resolveCargoProject (L21-49)**: Main project resolver that:
- Reads and parses Cargo.toml using regex patterns for name/version extraction
- Calls getCargoTargets() to fetch build targets via cargo metadata
- Returns project info object or null on failure
- Uses simplified TOML parsing rather than full parser

**getCargoTargets (L54-96)**: Spawns `cargo metadata` subprocess to extract project targets:
- Executes cargo metadata command with format-version 1
- Parses JSON output to extract targets from packages
- Filters targets by manifest path matching project directory
- Returns empty array on any errors (spawn failures, JSON parsing issues)

**findBinaryTargets (L101-106)**: Convenience wrapper filtering targets to binary executables only.

### Build and Test Operations

**runCargoTest (L111-151)**: Executes cargo test with optional test name filtering:
- Spawns cargo test subprocess with configurable arguments
- Captures both stdout and stderr
- Returns success boolean and combined output

**runCargoBuild (L228-264)**: Generic cargo build executor:
- Takes custom build arguments array
- Captures build output but doesn't determine binary path
- Returns success status and full output

**buildCargoProject (L319-383)**: High-level build function with progress reporting:
- Supports debug/release build modes
- Integrates with optional logger for progress messages
- Determines binary path after successful build
- Returns comprehensive result object with binary path

### Build Optimization

**needsRebuild (L156-197)**: Intelligent rebuild detection comparing modification times:
- Checks if target binary exists in appropriate debug/release directory
- Compares binary mtime against all .rs source files
- Includes Cargo.toml modification time check
- Handles Windows .exe extension automatically

**getAllRustFiles (L202-223)**: Private recursive directory scanner for .rs files.

### Path Resolution

**findCargoProjectRoot (L294-314)**: Walks directory tree upward to locate Cargo.toml:
- Starts from given file path and traverses parent directories
- Stops at filesystem root or when Cargo.toml found
- Throws error if no Cargo project found

**getDefaultBinary (L269-289)**: Determines primary binary name using fallback strategy:
- First tries binary targets from cargo metadata
- Falls back to package name from Cargo.toml
- Last resort checks for src/main.rs existence

### Dependencies and Architecture

**Key Dependencies**:
- Node.js fs/promises for async file operations
- child_process.spawn for cargo command execution
- path module for cross-platform path handling

**Error Handling Pattern**: Most functions use try-catch with graceful degradation, returning null/empty arrays rather than throwing exceptions.

**Cross-Platform Considerations**: Handles Windows .exe extension in multiple locations, uses shell:true for spawn calls.