# tests/core/unit/utils/session-migration.test.ts
@source-hash: aae494d446eae0c5
@generated: 2026-02-09T18:14:25Z

## Purpose
Unit tests for verifying migration from deprecated `pythonPath` parameter to new `executablePath` parameter in session creation. Validates TypeScript type safety and ensures all debug session interfaces use the new parameter consistently across the DebugMCP system.

## Test Structure
Test suite organized into 6 verification scenarios within main describe block (L8-132):

### Key Test Functions
- **pythonPath rejection test (L9-25)**: Verifies TypeScript prevents using deprecated `pythonPath`, ensures only `executablePath` exists on session objects
- **Multi-language support test (L27-47)**: Tests `executablePath` works with Python and Mock languages, validates session creation and retrieval
- **Default executable path test (L49-70)**: Tests platform-specific defaults when `executablePath` not provided (python3 on Unix, python on Windows)
- **API migration completeness test (L72-108)**: Documents all migrated interfaces (CreateSessionParams, ProxyConfig, ProxyInitPayload) use `executablePath`
- **Multi-executable demonstration (L110-131)**: Shows flexible executable path support across different Python installations and platforms

## Dependencies
- `SessionStore` and `CreateSessionParams` from `../../../../src/session/session-store.js` (L5)
- `DebugLanguage` enum from `@debugmcp/shared` (L6)
- Vitest testing framework (L4)

## Key Patterns
- Environment variable manipulation with cleanup pattern (L53-69)
- Type assertion casting with `as CreateSessionParams` for migration verification (L17)
- Parameterized testing with test case arrays (L114-120)
- Session lifecycle testing (create → retrieve → verify)

## Critical Constraints
- All debug session creation must use `executablePath` instead of deprecated `pythonPath`
- Platform-specific executable defaults required for Python sessions
- TypeScript compiler should prevent usage of old parameter names
- Session store must maintain backward compatibility while enforcing new interface