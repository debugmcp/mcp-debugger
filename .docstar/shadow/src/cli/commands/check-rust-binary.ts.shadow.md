# src/cli/commands/check-rust-binary.ts
@source-hash: 095b5ff80de469d3
@generated: 2026-02-10T00:41:24Z

## Purpose
CLI command handler that analyzes Rust executable binaries to extract debugging compatibility information, toolchain details, and runtime dependencies. Part of a debugging MCP adapter system.

## Core Architecture

### Lazy Module Loading
- `detectBinaryFormatFn` (L6): Cached function reference for binary analysis
- `ensureDetectBinaryFormat()` (L8-25): Lazy loads `@debugmcp/adapter-rust` module with helpful error messaging for missing builds

### Main Handler
- `handleCheckRustBinaryCommand()` (L89-120): Primary entry point that validates binary path, performs analysis, and outputs results
- Validates file existence and accessibility (L100-109)
- Supports both JSON and human-readable output formats (L114-119)

### Output Formatting
- `formatSummary()` (L38-76): Generates detailed human-readable analysis report including:
  - Toolchain type (GNU/MSVC)
  - Debug format and PDB information
  - Runtime dependencies filtering
  - Debugging compatibility assessment
  - Toolchain recommendations for MSVC binaries
- `formatImports()` (L31-36): Formats dependency lists with fallback for empty arrays
- `writeOutput()`/`writeError()` (L78-87): Console output utilities with newline handling

## Key Dependencies
- `@debugmcp/adapter-rust`: Core binary analysis functionality (BinaryInfo type, detectBinaryFormat function)
- Node.js `fs.promises` and `path` for file system operations

## Interface
- `CheckRustBinaryOptions` (L27-29): Configuration object with optional JSON output flag
- Accepts binary path string and optional configuration
- Returns Promise<void> but outputs results to stdout/stderr

## Notable Patterns
- Error handling with user-friendly build instructions (L17-22)
- Conditional toolchain-specific recommendations (L65-73)
- Runtime dependency filtering using regex patterns (L51-53)
- Graceful handling of missing debug information with fallbacks (L45)