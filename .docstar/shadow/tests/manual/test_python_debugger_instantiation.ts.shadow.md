# tests\manual\test_python_debugger_instantiation.ts
@source-hash: eb843fd330952dea
@generated: 2026-02-21T08:28:07Z

## Purpose
Manual test file that validates basic instantiation of the PythonDebugger class from the debugpy module. This is a standalone test script that verifies the constructor works without throwing errors.

## Key Functions
- `testInstantiation()` (L3-27): Main test function that creates a PythonDebugger instance with dummy configuration and validates successful instantiation through console logging and basic null checks.

## Dependencies
- Imports `PythonDebugger` and `PythonDebuggerConfig` from `../../src/debugger/python/debugpy.js` (L1)

## Test Configuration
- Uses hardcoded Windows Python path: `C:\Python313\python.exe` (L9)
- Creates dummy session ID: `test-instantiation-session` (L6)
- Minimal config object with only `sessionId` and `pythonPath` properties (L7-10)

## Test Flow
1. Logs test start (L4)
2. Creates dummy configuration object (L6-10) 
3. Attempts PythonDebugger instantiation with try-catch error handling (L12-25)
4. Validates instance is not null (L17-21)
5. Logs completion status (L26)

## Execution
Auto-executes the test function on module load (L29)

## Architecture Notes
- Pure instantiation test - doesn't test any debugger functionality beyond constructor
- Uses comprehensive console logging with `[INSTANTIATION_TEST]` prefix for easy identification
- Error handling captures and logs any constructor exceptions