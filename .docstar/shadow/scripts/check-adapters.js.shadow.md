# scripts/check-adapters.js
@source-hash: 9cf44abe560242b4
@generated: 2026-02-09T18:15:15Z

## Primary Purpose
CLI utility script that checks the vendoring status of debug adapters in a multi-adapter debugging environment. Provides unified status reporting for JavaScript (js-debug) and Rust (CodeLLDB) debug adapters with platform-specific validation.

## Key Functions & Components

**Configuration (L17-32)**: Static adapter definitions array containing:
- JavaScript adapter config with vendor paths and required sidecars
- Rust adapter config with multi-platform support (win32-x64, darwin-x64/arm64, linux-x64/arm64)

**Platform Detection (L37-48)**: `getCurrentPlatform()` maps Node.js process.platform/arch to standardized platform identifiers for cross-platform binary validation.

**File System Utilities**:
- `exists()` (L53-60): Safe file existence checking with try/catch
- `readJsonSafe()` (L65-71): JSON parsing with error handling

**Adapter Checkers**:
- `checkJavaScriptAdapter()` (L76-116): Validates main vendor file, manifest version, and required sidecars
- `checkRustAdapter()` (L121-166): Multi-platform binary validation with current platform detection

**Display Functions**:
- `formatStatus()` (L171-218): Console output with colored status indicators and detailed platform/sidecar reporting
- `main()` (L223-269): Orchestrates checking, formats output, provides remediation instructions, exits with status code

## Dependencies & Architecture
- Node.js built-ins: `fs`, `path`, `url` for file operations and ES module support
- ES modules with `import.meta.url` for script location detection (L12-14)
- Executable script with shebang and direct invocation detection (L271-276)

## Key Patterns
- **Platform-aware validation**: Different check strategies for JavaScript (file-based) vs Rust (platform-binary based)
- **Status aggregation**: Collects issues and provides actionable feedback with pnpm commands
- **CI integration**: Conditional exit codes based on CI environment detection (L266-268)
- **Colored console output**: ANSI escape codes for visual status indication

## Critical Invariants
- Current platform must have corresponding vendored binaries for Rust adapter
- JavaScript adapter requires both main vendor file and sidecars (bootloader.js, hash.js)
- Script can be imported or executed directly with different behaviors
- Exit code 1 only in non-CI environments when adapters missing