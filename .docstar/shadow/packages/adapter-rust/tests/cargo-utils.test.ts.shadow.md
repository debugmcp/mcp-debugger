# packages/adapter-rust/tests/cargo-utils.test.ts
@source-hash: 2c687d1ea61567b4
@generated: 2026-02-09T18:14:38Z

## Purpose
Test suite for cargo-utils module that provides utilities for interacting with Rust Cargo projects. Validates functionality for project resolution, target discovery, building, testing, and project structure analysis.

## Key Test Structure

### Mock Infrastructure
- `spawnMock` (L9-16): Mock implementation of `child_process.spawn` for controlling cargo command execution
- `createMockProcess` (L19-46): Factory function that creates mock child processes with configurable stdout/stderr output and exit codes
- `createTempProject` (L50-57): Helper that creates temporary Rust projects with basic Cargo.toml and main.rs structure
- `withBinaryExtension` (L59-60): Cross-platform binary name helper (adds .exe on Windows)

### Test Setup/Teardown
- `beforeEach` (L62-64): Resets spawn mock between tests
- `afterEach` (L66-74): Cleans up temporary directories created during testing
- `tempDirs` (L48): Array tracking temporary directories for cleanup

### Test Suites

#### resolveCargoProject Tests (L76-130)
Validates project metadata parsing and Cargo.toml reading:
- Successful metadata parsing with binary targets
- Handling missing project names
- Graceful failure when Cargo.toml is missing

#### getCargoTargets Tests (L132-177)
Tests target extraction from cargo metadata:
- Filtering targets by manifest path
- Error handling for malformed JSON and command failures

#### findBinaryTargets Tests (L179-203)
Validates filtering of binary-only targets from project metadata.

#### runCargoTest Tests (L205-229)
Tests cargo test execution with output collection and error handling.

#### needsRebuild Tests (L231-264)
Validates rebuild necessity detection based on file modification times:
- Binary older than sources triggers rebuild
- Fresh binary avoids unnecessary rebuilds
- Missing binary always requires rebuild

#### getDefaultBinary Tests (L266-336)
Tests binary name resolution logic with multiple fallback strategies:
- First binary target from metadata
- Package name when no binary targets exist
- Directory name when main.rs exists but no metadata
- "main" as final fallback

#### findCargoProjectRoot Tests (L338-357)
Validates upward directory traversal to locate Cargo.toml root.

#### runCargoBuild Tests (L359-391)
Tests cargo build command execution with success/failure output capture.

#### buildCargoProject Tests (L393-480)
Comprehensive build process testing including:
- Successful build with binary path resolution
- Build failure error reporting
- Spawn error handling

## Dependencies
- **vitest**: Testing framework with mocking capabilities
- **Node.js built-ins**: fs/promises, fs, path, os for file system operations
- **events.EventEmitter**: For mock process event simulation

## Architecture Patterns
- **Mock-first testing**: All cargo commands are mocked to avoid external dependencies
- **Temporary file system**: Each test creates isolated temporary Rust projects
- **Cross-platform support**: Windows binary extension handling throughout tests
- **Async/await**: All file operations and process spawning use promises