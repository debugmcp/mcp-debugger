# packages/adapter-rust/tests/rust-adapter.test.ts
@source-hash: cef19ba59fa0e0de
@generated: 2026-02-09T18:14:36Z

This file contains comprehensive test suites for the Rust Debug Adapter implementation using Vitest framework.

## Primary Purpose
Test coverage for the Rust debugging infrastructure, validating adapter functionality, configuration handling, and factory pattern implementation for Rust debugging within the DebugMCP ecosystem.

## Key Test Suites

### RustDebugAdapter Tests (L52-248)
- **Basic Properties** (L60-70): Validates adapter initialization, language identification (DebugLanguage.RUST), and initial state (AdapterState.UNINITIALIZED)
- **Capabilities** (L72-96): Verifies support for Rust debugging features including conditional breakpoints, function breakpoints, data breakpoints, disassembly, and log points. Explicitly tests that reverse debugging (step back) is NOT supported
- **buildAdapterCommand** (L98-170): Tests CodeLLDB command construction with TCP mode configuration, error handling for missing executable, and port validation
- **transformLaunchConfig** (L172-221): Validates launch configuration transformation for explicit program paths and Cargo-based builds, including platform-specific handling for Windows (.exe extension)
- **Connection Management** (L223-235): Tests adapter connection lifecycle and state transitions
- **Error Messages** (L237-247): Validates error message translation with helpful user guidance

### RustAdapterFactory Tests (L250-282)
Tests the factory pattern implementation for creating Rust debug adapters, metadata provision, and environment validation.

## Mock Infrastructure (L17-50)
Comprehensive mock setup for `AdapterDependencies` including:
- File system operations (read/write/stat/mkdir/etc.)
- Logger interface
- Environment variable access
- Process launching capabilities

## Key Dependencies
- `@debugmcp/shared`: Core types and interfaces (AdapterState, DebugLanguage, DebugFeature, etc.)
- `../src/rust-debug-adapter.js`: Main adapter implementation
- `../src/rust-adapter-factory.js`: Factory for adapter creation
- `vitest`: Testing framework with mocking capabilities
- `path`: Node.js path utilities for cross-platform file handling

## Testing Patterns
- Uses Vitest's `vi.fn()` for mocking and `vi.spyOn()` for method stubbing
- Employs type casting to access private methods for testing (L101, L131, L152)
- Includes platform-specific test logic for Windows vs Unix systems
- Mock restoration after each test to prevent state leakage

## Critical Test Scenarios
- CodeLLDB executable resolution and command building
- Cargo project detection and binary path construction
- TCP port validation and connection management
- Error handling and user-friendly error message generation
- Platform-specific behavior (Windows PDB reader, executable extensions)