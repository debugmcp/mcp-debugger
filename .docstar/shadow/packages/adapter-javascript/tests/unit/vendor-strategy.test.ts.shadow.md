# packages/adapter-javascript/tests/unit/vendor-strategy.test.ts
@source-hash: a9bbaf8841f19750
@generated: 2026-02-10T00:41:08Z

## Purpose
Unit test suite for the vendor-strategy module, validating environment variable parsing and vendoring plan determination logic for JavaScript debug server deployment strategies.

## Test Structure

### parseEnvBool Tests (L5-17)
- **Primary test**: Validates string-to-boolean conversion for environment variables
- **Key behavior**: Only accepts "true" (case-insensitive) as truthy, all other values return false
- **Edge cases covered**: Handles undefined, null, empty strings, numbers, and whitespace

### determineVendoringPlan Tests (L19-52)
- **Local path preference** (L20-27): When `JS_DEBUG_LOCAL_PATH` is non-empty, returns local mode with specified path
- **Source building** (L29-36): When `JS_DEBUG_BUILD_FROM_SOURCE=true` but no local path, returns prebuilt-then-source mode  
- **Default behavior** (L38-45): Falls back to prebuilt-only mode when source building is disabled
- **Missing environment** (L47-51): Treats empty environment as prebuilt-only mode

## Dependencies
- **Testing framework**: vitest (L1)
- **Module under test**: `../../scripts/lib/vendor-strategy` providing `parseEnvBool` and `determineVendoringPlan` functions (L3)

## Test Data Patterns
- Uses Record<string, string | undefined> type for environment simulation
- Tests prioritization logic: local path > source building > prebuilt fallback
- Validates return type contracts for vendoring plan objects

## Architecture Notes
- Tests demonstrate a three-tier vendoring strategy for JavaScript debug server deployment
- Environment variables control build vs. prebuilt vs. local file usage decisions
- Plan objects use discriminated union pattern with mode-specific properties