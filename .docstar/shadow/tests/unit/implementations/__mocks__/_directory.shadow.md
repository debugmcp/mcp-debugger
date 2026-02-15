# tests\unit\implementations\__mocks__/
@children-hash: 0cffb974d431f77f
@generated: 2026-02-15T09:01:21Z

## Purpose

This directory contains Jest/Vitest manual mocks for Node.js built-in modules and external libraries, providing controlled replacements during unit testing to isolate tests from system dependencies and side effects.

## Architecture

Following Jest/Vitest `__mocks__` convention, this directory enables automatic mock resolution when the corresponding modules are imported in test files. The framework automatically substitutes these mocks for the real implementations during test execution.

### Mock Components

- **child_process.js**: Manual mock for Node.js `child_process` module
  - Replaces `spawn` and `exec` functions with Jest mock functions
  - Prevents actual subprocess execution during testing

- **fs-extra.js**: Comprehensive mock for the `fs-extra` filesystem library
  - Provides Vitest mock functions for all major filesystem operations
  - Covers file I/O, directory management, path utilities, and JSON operations
  - Supports both named and default import patterns

## Key Features

**Automatic Mock Resolution**: Mocks are automatically loaded when their corresponding modules are imported in test files, requiring no explicit mock setup in individual tests.

**Comprehensive Coverage**: 
- Process execution mocking (child_process)
- Complete filesystem operation mocking (fs-extra)
- Dual import pattern support for maximum compatibility

**Testing Framework Agnostic**: Supports both Jest (`jest.fn()`) and Vitest (`vi.fn()`) mock function factories.

## Usage Pattern

Tests importing `child_process` or `fs-extra` will automatically receive these mock implementations instead of the real modules, enabling:
- Predictable test behavior without external system dependencies
- Prevention of actual file system modifications or process spawning
- Controlled testing of error conditions and edge cases

## Integration

This mock directory integrates with the broader test suite by providing foundational infrastructure for unit tests that need to interact with system resources without causing side effects or depending on external system state.