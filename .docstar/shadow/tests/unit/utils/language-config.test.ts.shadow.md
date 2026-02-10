# tests/unit/utils/language-config.test.ts
@source-hash: 42777cb854983c43
@generated: 2026-02-10T00:41:36Z

## Purpose
Unit test suite for language configuration utilities that handle environment-based language disabling functionality. Tests the parsing and querying of disabled languages from the `DEBUG_MCP_DISABLE_LANGUAGES` environment variable.

## Test Structure
- **Main test suite** (L6-41): "language configuration helpers" - comprehensive testing of language configuration functions
- **Environment setup/teardown** (L7-13): Preserves and restores original `process.env` state using `beforeEach`/`afterEach` hooks
- **Original environment backup** (L4): Captures initial environment state for restoration

## Tested Functions
Tests two key utilities from `../../../src/utils/language-config.js`:
- `getDisabledLanguages()`: Parses comma-separated language list from environment variable
- `isLanguageDisabled(language)`: Checks if specific language is in disabled set

## Test Cases

### Environment Variable Parsing (L15-21)
Tests `getDisabledLanguages()` with various input formats:
- Handles mixed case ("python, Rust")  
- Trims whitespace around entries
- Filters out empty strings from extra commas
- Returns normalized Set with lowercase entries

### Missing Environment Variable (L23-26)
Verifies graceful handling when `DEBUG_MCP_DISABLE_LANGUAGES` is undefined:
- Deletes environment variable
- Expects empty Set return value

### Case-Insensitive Language Detection (L28-34)
Tests `isLanguageDisabled()` behavior:
- Environment contains "PYTHON,RUST" (uppercase)
- Queries with mixed case ("python", "Rust") return `true`
- Non-disabled language ("mock") returns `false`

### Input Validation (L36-40)
Tests robustness with invalid inputs:
- Empty string returns `false`
- `null` (cast as string) returns `false`
- Maintains type safety despite forced casting

## Key Patterns
- **Environment isolation**: Each test runs with clean environment state
- **Case normalization**: Tests demonstrate case-insensitive language matching
- **Whitespace handling**: Validates robust parsing of user-provided environment values
- **Edge case coverage**: Tests both missing data and invalid input scenarios