# tests/adapters/rust/
@generated: 2026-02-10T01:19:46Z

## Purpose
Integration testing directory for the Rust debugger adapter that validates end-to-end adapter functionality through comprehensive smoke testing. This module ensures the Rust adapter correctly integrates with the debugger infrastructure, builds proper CodeLLDB commands, and transforms launch configurations across platforms without requiring actual process execution or external dependencies.

## Key Components and Architecture

**Mock-Based Testing Infrastructure**: The directory implements a sophisticated dependency injection pattern that isolates adapter logic from system resources:
- Stubbed file system operations and process launchers prevent actual external calls
- Mock logger and environment access provide controlled test environments
- Cross-platform compatibility testing through environment variable management

**Integration Test Coverage**: Comprehensive validation of the complete adapter workflow:
- Command building for CodeLLDB with proper executable paths, port configuration, and platform-specific flags
- Launch configuration transformation including path normalization and standardized output format
- Cross-platform behavior verification (Windows .exe handling, environment variables)

## Public API and Entry Points

**Primary Test Suite**: 
- `integration/rust-session-smoke.test.ts` - Main integration test that exercises the complete RustAdapterFactory workflow through mock dependencies

**Key Validation Areas**:
- CodeLLDB command generation with correct arguments and environment setup
- Launch configuration transformation (relative to absolute paths, debugger type setting)
- Platform-specific behavior (Windows LLDB_USE_NATIVE_PDB_READER, RUST_BACKTRACE variables)

## Internal Organization and Data Flow

**Test Setup Pattern**: Each test follows a consistent pattern:
1. Environment preparation with platform-specific variables and paths
2. Mock dependency injection through `createDependencies()`
3. Adapter factory instantiation and session creation
4. Command building and configuration transformation validation
5. Clean teardown of environment state

**Cross-Platform Testing Strategy**: The module ensures adapter compatibility across operating systems by:
- Managing platform-specific binary naming conventions
- Testing environment variable handling for different platforms
- Validating network configuration (localhost, port 48765) uniformly

## Integration Role
This directory serves as the critical validation layer between the Rust adapter implementation and the broader debugger system, ensuring proper integration without external dependencies. It validates that the adapter correctly interfaces with CodeLLDB while maintaining platform compatibility and proper command generation patterns essential for reliable debugging functionality.