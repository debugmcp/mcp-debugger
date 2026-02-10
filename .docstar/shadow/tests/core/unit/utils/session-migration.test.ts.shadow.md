# tests/core/unit/utils/session-migration.test.ts
@source-hash: b3bdc2d9b406fd90
@generated: 2026-02-10T01:18:59Z

## Purpose
Unit test suite verifying the migration from `pythonPath` to `executablePath` parameter in session management. Ensures the old API has been fully replaced and validates the new parameter works across all supported debug languages.

## Test Structure
- **Main describe block (L8-131)**: "Session Migration Verification" - comprehensive migration validation
- **Test imports (L4-6)**: Uses vitest framework, imports SessionStore and CreateSessionParams from session module, DebugLanguage enum from shared package

## Key Test Cases

### Migration Verification Tests
- **pythonPath rejection test (L9-24)**: Verifies TypeScript prevents using old `pythonPath` parameter, confirms only `executablePath` exists on created sessions
- **Multi-language support test (L26-46)**: Tests both Python and Mock languages work with `executablePath`, validates language-specific behavior

### Default Handling Tests  
- **Platform defaults test (L48-69)**: Tests executable path defaults when not provided, handles environment variable cleanup, validates platform-specific defaults (python vs python3)

### API Migration Validation
- **Complete migration test (L71-107)**: Documents that all interfaces use `executablePath`:
  - CreateSessionParams (L76-79)
  - ProxyConfig (L82-90) 
  - ProxyInitPayload (L93-101)

### Flexibility Demonstration
- **Multi-executable test (L109-130)**: Demonstrates various executable paths work across languages, tests edge cases like Mock language with executable

## Dependencies
- **SessionStore**: Core session management class from `src/session/session-store.js`
- **DebugLanguage**: Enum defining supported debug languages (PYTHON, MOCK)
- **CreateSessionParams**: Type interface for session creation parameters

## Key Patterns
- Environment variable isolation using try/finally blocks (L52-68)
- Platform-specific executable defaults (win32 vs unix)
- Type safety validation through TypeScript compilation
- Comprehensive API interface validation through inline examples

## Test Data Patterns
- Uses realistic executable paths for different platforms
- Tests both required and optional parameter scenarios
- Validates both positive cases (works) and negative cases (old API rejected)