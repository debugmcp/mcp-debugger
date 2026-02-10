# tests/unit/cli/version.test.ts
@source-hash: c7d94f832e06fb89
@generated: 2026-02-09T18:14:39Z

## Purpose
Unit test suite for the `getVersion()` utility function that reads version information from package.json. Tests error handling, edge cases, and console output suppression.

## Test Structure
- **Test Suite** (L7-86): "Version Utility" - comprehensive coverage of version reading functionality
- **Setup/Teardown** (L10-17): Console error spy management with proper cleanup
- **Core Dependencies**: Vitest testing framework, mocked `fs` module (L5)

## Test Cases

### Happy Path
- **Version Reading Test** (L19-31): Verifies successful extraction of version "1.2.3" from valid package.json
- **Missing Version Test** (L33-44): Handles package.json without version field, expects fallback to "0.0.0"
- **Empty Package Test** (L67-73): Validates behavior with empty JSON object

### Error Scenarios  
- **File Read Error Test** (L46-56): Tests file system errors, expects "0.0.0" return and error logging
- **Invalid JSON Test** (L58-65): Handles malformed JSON, expects "0.0.0" return and error logging
- **Console Suppression Test** (L75-85): Verifies error logging is suppressed when `CONSOLE_OUTPUT_SILENCED=1`

## Key Patterns
- Consistent fallback behavior: all error conditions return "0.0.0"
- Error logging verification using console spy
- Environment variable handling for output control
- Proper mock cleanup in afterEach hook (L14-17)

## Testing Strategy
- Mock-first approach with `vi.mock('fs')` (L5)
- Console output interception for error validation
- Edge case coverage including malformed data and missing files
- Environment variable testing for conditional logging