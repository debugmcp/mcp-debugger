# packages/adapter-rust/src/utils/cargo-utils.ts
@source-hash: 0bfd359c192a062d
@generated: 2026-02-10T00:41:23Z

## Cargo Project Utilities

This utility module provides comprehensive Rust Cargo project management functionality for a Rust adapter. It handles project discovery, metadata extraction, building, testing, and file system operations for Cargo-based Rust projects.

### Core Data Structures

**CargoTarget Interface (L12-16)**: Represents a Cargo compilation target with name, kind array (bin, lib, test, etc.), and source path.

### Primary Functions

**resolveCargoProject(projectPath) (L21-49)**: Main project resolver that:
- Reads and parses Cargo.toml for project name/version using regex
- Fetches compilation targets via cargo metadata
- Returns structured project info or null on failure
- Uses simplified TOML parsing instead of full parser

**getCargoTargets(projectPath) (L54-96)**: Executes `cargo metadata --format-version 1` to extract target information:
- Spawns cargo process and captures JSON output
- Filters packages by project path to avoid workspace conflicts  
- Maps cargo metadata format to CargoTarget interface
- Returns empty array on any failure

**findBinaryTargets(projectPath) (L101-106)**: Convenience function that filters targets for binary executables only.

**runCargoTest(projectPath, testName?) (L111-151)**: Test execution wrapper:
- Spawns `cargo test` with optional test name filter
- Captures stdout/stderr and combines for output
- Returns success boolean and combined output

**needsRebuild(projectPath, binaryName, release?) (L156-197)**: Intelligent rebuild detection:
- Compares binary mtime against source files and Cargo.toml
- Handles platform-specific executable extensions (.exe on Windows)
- Uses getAllRustFiles helper for recursive .rs file discovery
- Returns true if binary missing or sources newer

**runCargoBuild(projectPath, args) (L228-264)**: Generic build executor that spawns cargo with custom arguments and returns success status with output.

**getDefaultBinary(projectPath) (L269-289)**: Binary name resolution with fallback chain:
1. First binary target from cargo metadata
2. Package name from Cargo.toml
3. Project directory name if main.rs exists
4. "main" as last resort

**findCargoProjectRoot(filePath) (L294-314)**: Walks up directory tree from given file path to locate nearest Cargo.toml, similar to git root discovery.

**buildCargoProject(projectRoot, logger?, buildMode?) (L319-383)**: High-level build function with:
- Progress logging integration
- Debug/release mode support
- Binary path resolution post-build
- Comprehensive error handling and reporting

### Internal Utilities

**getAllRustFiles(dir) (L202-223)**: Recursive directory walker that collects all .rs files, used by needsRebuild for change detection.

### Key Patterns

- **Promise-based async operations**: All functions return Promises, with spawn operations wrapped in Promise constructors
- **Graceful error handling**: Most functions return null/empty arrays instead of throwing
- **Cross-platform compatibility**: Handles Windows .exe extensions and uses shell: true for spawn calls
- **Cargo CLI integration**: Heavy reliance on spawning cargo subcommands rather than parsing internals
- **File system monitoring**: Uses mtime comparisons for efficient rebuild detection

### Dependencies

- Node.js fs/promises for async file operations
- child_process.spawn for cargo command execution
- path module for cross-platform file path handling