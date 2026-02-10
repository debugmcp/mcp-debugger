# packages/adapter-javascript/tests/unit/vendor-strategy.test.ts
@source-hash: a9bbaf8841f19750
@generated: 2026-02-09T18:14:02Z

## Purpose
Unit test file validating the vendor-strategy module's environment parsing and vendoring plan determination logic. Tests two core functions that control how JavaScript debug server dependencies are resolved and vendored during build processes.

## Test Structure

### parseEnvBool Tests (L5-17)
- **Purpose**: Validates boolean parsing from environment variables
- **Key behavior**: Only accepts "true" (case-insensitive) as truthy; all other values including "false", numbers, undefined, null return false
- **Edge cases tested**: Mixed case strings, whitespace, type coercion, undefined/null values

### determineVendoringPlan Tests (L19-52)
- **Purpose**: Validates vendoring strategy selection based on environment variables
- **Environment variables tested**:
  - `JS_DEBUG_LOCAL_PATH`: Path to local debug server
  - `JS_DEBUG_BUILD_FROM_SOURCE`: Flag to enable source building
- **Strategy precedence** (L20-27):
  1. **Local mode**: When `JS_DEBUG_LOCAL_PATH` is non-empty, returns local path regardless of other settings
  2. **Prebuilt-then-source** (L29-36): When `JS_DEBUG_BUILD_FROM_SOURCE=true` but no local path
  3. **Prebuilt-only** (L38-51): Default fallback for all other cases

## Dependencies
- **vitest**: Testing framework (L1)
- **vendor-strategy module**: Imports `parseEnvBool` and `determineVendoringPlan` functions (L3)

## Test Coverage Patterns
- Comprehensive edge case testing for boolean parsing
- Environment variable precedence validation
- Default behavior verification
- Type safety testing with explicit type assertions for invalid inputs