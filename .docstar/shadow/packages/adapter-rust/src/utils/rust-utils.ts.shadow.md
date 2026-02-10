# packages/adapter-rust/src/utils/rust-utils.ts
@source-hash: ee638a9c1f2e1b19
@generated: 2026-02-09T18:14:10Z

## Primary Purpose
Rust toolchain utility module providing system-level operations for Rust development environments. Handles Rust/Cargo installation detection, project management, compilation, and platform-specific tooling resolution.

## Key Functions

### Installation Verification
- `checkCargoInstallation()` (L14-24): Spawns `cargo --version` process to verify Cargo availability
- `checkRustInstallation()` (L29-39): Spawns `rustc --version` process to verify Rust compiler availability  
- `getCargoVersion()` (L44-66): Extracts semantic version from Cargo output using regex pattern

### Project Management
- `findCargoProjectRoot(startPath)` (L77-100): Traverses filesystem upward from startPath to locate Cargo.toml, returns project root or null
- `buildRustProject(projectPath, release?)` (L105-145): Executes `cargo build` with optional release flag, captures stdout/stderr, returns success status and combined output
- `getRustBinaryPath(projectPath, binaryName, release?)` (L150-170): Constructs platform-aware binary path in target/{debug|release} directory with .exe extension on Windows

### System Information
- `getRustHostTriple()` (L175-204): Parses `rustc -Vv` output to extract host triple (e.g., "x86_64-pc-windows-msvc")
- `findDlltoolExecutable()` (L209-274): Multi-strategy dlltool.exe resolution:
  1. DLLTOOL environment variable
  2. PATH lookup via `which`
  3. Rustup toolchain scanning for Windows GNU targets

### External Dependencies
- Re-exports `resolveCodeLLDBExecutable` as `resolveCodeLLDBPath` (L72) from codelldb-resolver module

## Architectural Patterns
- Promise-based async operations with manual Promise construction for child process handling
- Cross-platform compatibility with Windows-specific executable extension handling
- Graceful degradation with null returns on tool resolution failures
- Environment variable precedence for tool overrides

## Critical Constraints
- All child processes use `shell: true` for cross-platform command execution
- File system operations use async fs.access() with F_OK constant for existence checks
- Windows-specific logic in dlltoolExecutable search targets `-pc-windows-gnu` toolchains only
- Error handling via try/catch blocks with fallback to null returns