# tests/manual/test_python_debugger_instantiation.ts
@source-hash: 0b63d6a19ea2f87e
@generated: 2026-02-09T18:15:09Z

## Purpose
Manual test file for verifying PythonDebugger instantiation functionality. Serves as a diagnostic tool to isolate and test the basic constructor behavior of PythonDebugger without full session setup.

## Key Components

### Main Test Function
- **testInstantiation() (L4-36)**: Async function that performs the core instantiation test
  - Creates dummy configuration with Windows Python path
  - Attempts PythonDebugger constructor call with extensive logging
  - Validates successful instantiation and non-null instance
  - Comprehensive error handling with tagged console output

### Configuration Setup
- **dummyConfig (L8-11)**: PythonDebuggerConfig object with:
  - Test session ID: 'test-instantiation-session'
  - Hard-coded Python path: 'C:\\Python313\\python.exe'

### Execution Flow
- **Test execution (L38)**: Direct function call - runs immediately when file is loaded
- Extensive console logging with `[INSTANTIATION_TEST]` tags for easy filtering

## Dependencies
- `PythonDebugger, PythonDebuggerConfig` from debugpy module
- `SessionConfig, DebugLanguage` from session models (imported but unused)

## Architecture Notes
- Minimal test scope: focuses solely on constructor validation
- Environment-specific: hardcoded Windows Python path
- Manual execution model: no test framework integration
- Defensive programming: null checks and comprehensive error catching

## Critical Constraints
- Requires valid Python installation at specified path
- Windows-specific path configuration
- No cleanup or teardown logic