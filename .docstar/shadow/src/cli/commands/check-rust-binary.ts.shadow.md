# src/cli/commands/check-rust-binary.ts
@source-hash: 095b5ff80de469d3
@generated: 2026-02-09T18:14:36Z

## Purpose

CLI command handler for analyzing Rust binary executables to determine their toolchain format, debug information availability, and debugger compatibility. Provides both JSON and human-readable output formats for binary inspection.

## Key Components

### Core Function
- **handleCheckRustBinaryCommand** (L89-120): Main entry point that validates binary path, analyzes the executable using the Rust adapter, and outputs results in requested format

### Binary Format Detection
- **ensureDetectBinaryFormat** (L8-25): Lazy loader for `@debugmcp/adapter-rust` module with error handling for missing dependencies
- **detectBinaryFormatFn** (L5-6): Cached function reference to avoid repeated imports

### Output Formatting
- **formatSummary** (L38-76): Creates comprehensive human-readable analysis report including:
  - Toolchain type (GNU vs MSVC)
  - Debug format and PDB availability
  - Runtime dependencies filtering
  - Debugging compatibility assessment
  - MSVC-specific rebuild recommendations
- **formatImports** (L31-36): Helper for formatting dependency lists
- **writeOutput/writeError** (L78-87): Console output utilities with proper newline handling

## Dependencies

- `@debugmcp/adapter-rust`: Rust binary analysis functionality (dynamically imported)
- Node.js built-ins: `path`, `fs.promises` for file system operations

## Architecture Patterns

### Lazy Loading Pattern
Dynamic import of Rust adapter (L14) with caching to handle optional dependencies gracefully

### Error Context Enhancement
Wraps import errors with actionable build instructions (L19-21)

### Format Detection Strategy
Distinguishes between GNU and MSVC toolchains to provide targeted compatibility guidance

## Critical Behavior

### Toolchain-Specific Recommendations
- GNU format: Full CodeLLDB support
- MSVC format: Limited debugging capability with rebuild suggestions (L65-73)
- Unknown format: Warning about potential debugging issues

### Runtime Dependency Analysis
Filters imports for common C runtime libraries using regex pattern (L51-53): `msvcrt|vcruntime|ucrtbase|msvcp|libstdc++|libgcc`

## Interface

**CheckRustBinaryOptions** (L27-29): Configuration interface supporting JSON output mode