# packages/adapter-rust/src/utils/rust-utils.ts
@source-hash: ee638a9c1f2e1b19
@generated: 2026-02-10T00:41:09Z

**Primary Purpose:** Rust development environment utilities for adapter-rust package, providing installation checks, project management, and build operations for Rust/Cargo toolchain.

**Key Functions:**

- `checkCargoInstallation()` (L14-24): Verifies Cargo availability by spawning `cargo --version`
- `checkRustInstallation()` (L29-39): Verifies Rust compiler availability via `rustc --version`
- `getCargoVersion()` (L44-66): Extracts Cargo version string from command output using regex
- `findCargoProjectRoot(startPath)` (L77-100): Traverses directory tree upward to locate Cargo.toml file
- `buildRustProject(projectPath, release?)` (L105-145): Executes cargo build with optional release flag, captures output/errors
- `getRustBinaryPath(projectPath, binaryName, release?)` (L150-170): Constructs and verifies path to compiled binary with platform-specific extensions
- `getRustHostTriple()` (L175-204): Parses host triple from `rustc -Vv` output
- `findDlltoolExecutable()` (L209-274): Locates dlltool.exe on Windows through PATH, env vars, or rustup toolchains

**Dependencies:**
- Node.js built-ins: child_process, path, fs/promises, os
- External: `which` for executable resolution
- Internal: re-exports `resolveCodeLLDBExecutable` from `./codelldb-resolver.js` (L72)

**Architecture Patterns:**
- Promise-wrapped spawn operations with error handling
- Platform-aware path construction (Windows .exe extension handling)
- Directory traversal with filesystem access checks
- Regex parsing for version extraction
- Environment variable overrides for tool locations

**Critical Constraints:**
- All spawn operations use `shell: true` for cross-platform compatibility
- Binary detection relies on filesystem access rather than execution
- Windows-specific dlltool search in rustup toolchain directories
- Error handling returns null/false rather than throwing exceptions