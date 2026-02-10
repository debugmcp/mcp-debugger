# tests/unit/utils/language-config.test.ts
@source-hash: 42777cb854983c43
@generated: 2026-02-09T18:14:45Z

## Purpose
Unit test suite for language configuration utilities that manage disabled programming languages via environment variables. Tests environment variable parsing, language filtering, and case-insensitive matching functionality.

## Test Structure
- **Test Suite (L6-41)**: "language configuration helpers" - comprehensive test coverage for language config utilities
- **Environment Setup (L4, L7-13)**: Preserves and restores original `process.env` state using `beforeEach`/`afterEach` hooks
- **Core Functions Under Test**: `getDisabledLanguages()` and `isLanguageDisabled()` imported from `../../../src/utils/language-config.js`

## Test Cases

### Environment Variable Parsing (L15-21)
- **Purpose**: Validates parsing of `DEBUG_MCP_DISABLE_LANGUAGES` environment variable
- **Behavior**: Tests comma-separated list parsing with whitespace handling and case normalization
- **Expected**: Input `'python,  Rust , ,  mock'` produces `Set(['python', 'rust', 'mock'])`

### Missing Environment Variable (L23-26) 
- **Purpose**: Ensures graceful handling when environment variable is undefined
- **Behavior**: Deletes `DEBUG_MCP_DISABLE_LANGUAGES` and verifies empty set return
- **Expected**: Returns `new Set()` when env var missing

### Case Insensitive Detection (L28-34)
- **Purpose**: Validates case-insensitive language matching in `isLanguageDisabled()`
- **Setup**: Sets env var to `'PYTHON,RUST'` (uppercase)
- **Assertions**: Tests mixed-case inputs ('python', 'Rust') return true, 'mock' returns false

### Input Validation (L36-40)
- **Purpose**: Tests handling of falsy/invalid language inputs
- **Edge Cases**: Empty string and null values should return false
- **Type Safety**: Uses type assertion `null as unknown as string` for null testing

## Dependencies
- **Test Framework**: Vitest (`describe`, `it`, `expect`, `beforeEach`, `afterEach`)
- **System Under Test**: Language config utilities from `../../../src/utils/language-config.js`
- **Environment**: Node.js `process.env` manipulation

## Key Patterns
- **Environment Isolation**: Careful preservation/restoration of process environment
- **Case Normalization**: Tests demonstrate lowercase normalization behavior
- **Set-based Storage**: Disabled languages stored as Set for O(1) lookups
- **Whitespace Handling**: Parser strips whitespace and filters empty entries