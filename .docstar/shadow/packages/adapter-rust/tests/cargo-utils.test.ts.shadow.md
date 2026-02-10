# packages/adapter-rust/tests/cargo-utils.test.ts
@source-hash: 2c687d1ea61567b4
@generated: 2026-02-10T00:41:32Z

**Test Suite for Cargo Utilities in Rust Adapter Package**

This file provides comprehensive test coverage for the `cargo-utils.js` module, focusing on Rust project build system integration. Tests use Vitest framework with mocked child processes to validate cargo command execution without actual system dependencies.

## Core Test Infrastructure

**Mock Process Factory** (`createMockProcess`, L19-46): Creates fake child processes with configurable stdout/stderr streams and exit codes. Uses EventEmitter to simulate async process behavior with queueMicrotask for proper event ordering.

**Temporary Project Builder** (`createTempProject`, L50-57): Generates minimal Rust project structures in temporary directories with basic Cargo.toml and main.rs files. Maintains cleanup registry in `tempDirs` array.

**Platform Binary Helper** (`withBinaryExtension`, L59-60): Handles Windows/Unix binary naming differences (.exe suffix on Windows).

**Test Lifecycle**: 
- `beforeEach` (L62-64): Resets spawn mock between tests
- `afterEach` (L66-74): Cleans up temporary directories with force removal

## Module Function Test Coverage

**`resolveCargoProject` Tests** (L76-130):
- Validates cargo metadata parsing for project resolution
- Tests fallback behavior when Cargo.toml is malformed or missing
- Expects null returns for invalid project structures

**`getCargoTargets` Tests** (L132-177):
- Verifies target extraction from cargo metadata JSON
- Tests filtering by manifest path to isolate project-specific targets
- Handles malformed JSON and process failure gracefully

**`findBinaryTargets` Tests** (L179-203):
- Confirms filtering of binary-only targets from metadata
- Excludes library and other non-binary target types

**`runCargoTest` Tests** (L205-229):
- Validates test execution with combined stdout/stderr output collection
- Tests error handling for spawn failures

**`needsRebuild` Tests** (L231-264):
- File timestamp comparison logic between binary and source files
- Handles missing binary detection requiring rebuild
- Uses artificial delays to ensure timestamp differences

**`getDefaultBinary` Tests** (L266-336):
- Multi-tier fallback strategy: binary targets → package name → directory name → "main"
- Tests each fallback level with appropriate project configurations

**`findCargoProjectRoot` Tests** (L338-357):
- Directory traversal logic to locate Cargo.toml
- Error handling for orphaned files outside Rust projects

**`runCargoBuild` Tests** (L359-391):
- Build process execution with output capture
- Success/failure status determination from exit codes

**`buildCargoProject` Tests** (L393-480):
- End-to-end build orchestration combining metadata resolution and build execution
- Binary path construction with platform-specific naming
- Logger integration for build process reporting
- Comprehensive error handling for various failure modes

## Key Dependencies

- **Vitest**: Test framework with mocking capabilities
- **fs/promises & fs**: File system operations for temporary project management  
- **child_process**: Mocked for cargo command execution
- **EventEmitter**: Process simulation infrastructure

## Architecture Notes

Tests follow a pattern of creating realistic temporary Rust projects, mocking cargo command responses with expected JSON metadata formats, and validating the utility functions' parsing and decision logic. The mock strategy isolates tests from actual cargo/rustc installation requirements while maintaining realistic interaction patterns.