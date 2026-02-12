# packages/adapter-rust/tests/
@generated: 2026-02-11T23:47:44Z

## Purpose
Comprehensive test suite for the Rust debug adapter package, providing validation coverage for all core components involved in Rust debugging integration, toolchain detection, binary analysis, and cargo build system interaction.

## Architecture Overview
This testing module validates the complete Rust debugging pipeline through isolated unit tests with extensive mocking. The tests cover the full debugging workflow from Rust project detection and compilation through binary format analysis and debug session management.

### Core Component Test Coverage

**RustDebugAdapter Tests** (`rust-adapter.test.ts`, `rust-debug-adapter.toolchain.test.ts`):
- Main adapter class functionality including capabilities, command building, and launch configuration
- Toolchain validation and environment setup across platforms (Windows MSVC vs GNU)
- CodeLLDB integration and executable resolution
- DAP (Debug Adapter Protocol) operation validation and connection management
- Platform-specific behavior testing with runtime platform override utilities

**Cargo Build System Tests** (`cargo-utils.test.ts`):
- Complete cargo command orchestration including metadata parsing, target resolution, and build execution
- Project structure detection and binary target identification
- Rebuild logic based on file timestamps and dependency analysis
- Multi-tier fallback strategies for binary resolution and project configuration

**Binary Analysis Tests** (`binary-detector.test.ts`):
- MSVC vs GNU compiler output detection through binary signature analysis
- Debug information format classification (PDB vs DWARF)
- DLL import extraction and platform-specific linking validation
- Graceful handling of unknown binary formats

**Rust Toolchain Tests** (`rust-utils.test.ts`):
- Rust installation validation (cargo, rustc) with version detection
- Host triple detection and platform-specific tool resolution
- Cross-platform binary path construction with proper file extensions
- DLLTOOL detection for Windows GNU toolchain support

## Key Testing Infrastructure

**Mock Process Factory**: Standardized child process simulation across all test files with configurable stdout/stderr streams, exit codes, and async event emission patterns.

**Temporary Project Builder**: Creates realistic Rust project structures for integration testing without requiring actual Rust installations or compiled artifacts.

**Platform Override Utilities**: Runtime platform switching capabilities for testing Windows vs Unix-specific behaviors in a controlled environment.

**Cleanup Management**: Comprehensive cleanup hooks ensuring test isolation through temporary directory removal and mock state reset.

## Public Test API Surface

**Primary Test Suites**:
- `RustDebugAdapter` - Core adapter functionality and capabilities
- `RustAdapterFactory` - Adapter instantiation and metadata
- `cargo-utils` - All Cargo build system integration functions
- `binary-detector` - Binary format detection and analysis
- `rust-utils` - Rust toolchain detection and validation utilities

**Test Utilities**:
- Mock process creation with realistic async behavior simulation
- Temporary Rust project generation for integration scenarios
- Platform-specific testing with runtime environment manipulation
- Binary test data generation with embedded compiler signatures

## Testing Patterns & Conventions

**Isolation Strategy**: Heavy use of Vitest mocks to isolate units under test from external dependencies (cargo, rustc, filesystem, processes).

**Cross-Platform Testing**: Explicit platform behavior validation using platform override utilities for Windows vs Unix-specific logic paths.

**Error Scenario Coverage**: Comprehensive negative testing including missing tools, invalid configurations, build failures, and malformed metadata.

**Realistic Data Simulation**: Uses synthetic but realistic binary data, JSON metadata, and process outputs that match actual Rust toolchain behavior without requiring real installations.

## Integration Points

Tests validate the complete debugging workflow integration:
1. Rust project detection → cargo metadata parsing → binary target identification
2. Toolchain validation → environment setup → CodeLLDB configuration  
3. Binary analysis → debug format detection → adapter capability configuration
4. Build orchestration → rebuild logic → debug session launch

The test suite ensures robust error handling and graceful degradation throughout the entire Rust debugging pipeline while maintaining cross-platform compatibility.