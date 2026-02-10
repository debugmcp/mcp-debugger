# tests/unit/cli/check-rust-binary.test.ts
@source-hash: 21b54a2ffa842ef4
@generated: 2026-02-09T18:14:40Z

## Primary Purpose
Unit tests for the `handleCheckRustBinaryCommand` CLI function, validating binary format detection and output formatting capabilities.

## Key Test Structure

**Test Setup (L3-41)**
- Mock functions: `statMock` (L3), `detectBinaryFormatMock` (L4) for fs.promises.stat and @debugmcp/adapter-rust module
- Mock module setup (L6-20): Replaces fs.promises.stat and detectBinaryFormat with controllable mocks
- Output capture: `stdoutWrite`/`stderrWrite` mocks (L24-25) replace process stdout/stderr
- Test lifecycle: `beforeEach` (L29-36) resets mocks and redirects output, `afterAll` (L38-41) restores original streams

**Core Test Cases (L43-102)**
- **Error validation** (L44-62): Tests missing path validation and file system error handling
- **JSON output** (L64-81): Validates binary analysis with JSON formatting option
- **Human-readable output** (L83-101): Tests formatted output for MSVC binaries with compatibility warnings

## Dependencies
- **vitest**: Testing framework with mocking capabilities
- **fs module**: File system operations (mocked)
- **@debugmcp/adapter-rust**: Binary format detection (mocked)
- **Target module**: `../../../src/cli/commands/check-rust-binary.js` (L22)

## Test Patterns
- **Mock-driven testing**: All external dependencies mocked for isolation
- **Output verification**: Captures and validates both stdout/stderr content
- **Error boundary testing**: Validates proper error handling and propagation
- **Format-specific testing**: Different behavior for GNU vs MSVC binary formats

## Mock Data Structures
- File stat results with `isFile()` method (L56-57, L65-67, L84-86)
- Binary analysis results with format, debug info, PDB status, and imports (L68-74, L87-93)