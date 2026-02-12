# tests/unit/utils/simple-file-checker.spec.ts
@source-hash: d147bd04f1c94c94
@generated: 2026-02-11T16:12:52Z

Unit test suite for the SimpleFileChecker utility class - a path-checking component with dual operation modes (host vs container).

## Core Test Structure

**Main Test Suite Setup (L8-48)**: Comprehensive test harness with mocked dependencies:
- `mockFileSystem` (L16-32): Mock IFileSystem interface with all standard file operations
- `mockEnvironment` (L35-39): Mock IEnvironment with environment variable access
- `mockLogger` (L42-44): Mock logger with debug method
- Test instance creation using constructor (L47)

## Test Scenarios

**Host Mode Tests (L50-115)**: Tests behavior when not running in container:
- Environment mock setup returns `undefined` for container detection (L52-54)
- File existence checking without path manipulation (L56-69)
- Non-existent file handling (L71-83) 
- System error handling with error message formatting (L85-99)
- Relative path rejection with validation error (L101-114)

**Container Mode Tests (L117-172)**: Tests container-specific path handling:
- Environment mock returns `MCP_CONTAINER='true'` and `MCP_WORKSPACE_ROOT='/workspace'` (L119-125)
- Relative path transformation by prepending `/workspace/` (L127-140)
- Always prepends workspace root, even to absolute paths (L142-155)
- Raw path handling without interpretation for Windows-like paths (L157-171)

**Factory Function Test (L174-179)**: Validates the `createSimpleFileChecker` factory function.

## Key Testing Patterns

The tests demonstrate a "hands-off" approach with simple path manipulation rules:
- Host mode: No path transformation, absolute paths required
- Container mode: Always prepend workspace root regardless of input path format
- No intelligent path parsing or OS-specific handling

## Dependencies

Imports from:
- `vitest` testing framework (L4)
- Main implementation: `SimpleFileChecker`, `createSimpleFileChecker` (L5)
- Interface definitions: `IFileSystem`, `IEnvironment` (L6)