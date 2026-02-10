# tests/adapters/python/unit/python-utils.test.ts
@source-hash: 816ad069d3703e9a
@generated: 2026-02-09T18:14:25Z

## Purpose
Comprehensive unit test suite for Python utility functions in the debugmcp adapter-python package. Tests Python executable discovery, version detection, and command finding across different platforms (Windows, Linux, macOS).

## Key Test Suites

### findPythonExecutable Tests (L58-326)
- **Cross-platform testing** (L59): Tests behavior on win32, linux, darwin platforms using `describe.each`
- **Priority resolution** (L68-93): Tests precedence order - user-specified path → PYTHON_PATH → PYTHON_EXECUTABLE env vars
- **GitHub Actions support** (L95-110): Windows-specific test for `pythonLocation` environment variable handling
- **Auto-detection logic** (L112-161): Platform-specific command search order:
  - Windows: `py` → `python` → `python3` 
  - Unix: `python3` → `python`
- **Fallback mechanisms** (L163-184): Tests graceful degradation through command list
- **Error handling** (L192-219): Tests behavior when no Python found or spawn errors occur
- **Windows Store alias detection** (L222-325): Specialized tests for Windows Store Python alias handling and validation

### getPythonVersion Tests (L328-414)
- **Version parsing** (L329-347): Extracts version from `python --version` stdout
- **stderr handling** (L349-367): Some Python versions output to stderr
- **Error scenarios** (L369-393): Spawn failures and non-zero exit codes return null
- **Fallback output** (L395-413): Returns raw output when version pattern not matched

### setDefaultCommandFinder Tests (L416-432)
- **Global configuration** (L417-431): Tests setting and restoring default command finder

## Mock Infrastructure

### Child Process Mocking (L14-22)
- **Partial mock strategy**: Preserves other APIs like `exec` to avoid breaking cleanup code
- **EventEmitter-based**: Mock processes emit events to simulate real spawn behavior

### Test Setup/Teardown (L27-56)
- **Environment cleanup** (L29-33): Clears Python-related environment variables
- **Mock reset** (L36-48): Fresh MockCommandFinder and default spawn behavior per test
- **Consistent state** (L51-56): Ensures no cross-test pollution

## Key Dependencies
- **@debugmcp/adapter-python**: Main module under test (L5,7)
- **MockCommandFinder**: Test utility for simulating command resolution (L6)
- **vitest**: Test framework with mocking capabilities (L1)
- **child_process**: Mocked for spawn simulation (L2)

## Architectural Patterns
- **Platform-specific testing**: Uses `describe.each` for cross-platform validation
- **Mock strategy**: Partial mocks preserve system functionality while isolating test subjects
- **Event-driven simulation**: Mock processes use EventEmitter to simulate async spawn behavior
- **Error propagation testing**: Validates both wrapped and unwrapped error scenarios

## Critical Test Constraints
- **Platform isolation**: Each test platform is stubbed globally to ensure consistent behavior
- **Environment variable hygiene**: Tests clean up Python-related env vars to prevent interference
- **Mock lifecycle management**: Proper setup/teardown prevents state leakage between tests
- **Async process simulation**: Mock spawn processes emit events on next tick to simulate real timing