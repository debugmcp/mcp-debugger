# tests\adapters\python\unit\python-utils.test.ts
@source-hash: 4e2432a2326cb883
@generated: 2026-02-12T21:00:38Z

## Primary Purpose
Unit test file for Python utility functions in the debugmcp adapter. Tests Python executable discovery, version detection, and command finder functionality across different platforms (Windows, Linux, macOS).

## Key Test Suites

### findPythonExecutable Tests (L72-334)
- **Cross-platform testing** (L73-228): Tests executable discovery on win32/linux/darwin platforms
- **Environment variable handling**: Tests PYTHON_PATH (L91-98), PYTHON_EXECUTABLE (L100-107), pythonLocation (L109-124)
- **Platform-specific command prioritization**: Windows uses `py -> python -> python3`, Unix uses `python3 -> python`
- **Windows Store alias detection** (L230-333): Tests validation of Windows Store Python aliases and their rejection
- **Command fallback logic** (L177-198): Tests cascading through available Python commands
- **Error handling** (L200-227): Tests behavior when no Python found or spawn errors occur

### getPythonVersion Tests (L336-422)
- **Version extraction** (L337-355): Tests parsing Python version from `--version` output
- **Multi-stream handling** (L357-375): Tests version output on both stdout and stderr
- **Error scenarios** (L377-401): Tests spawn errors and non-zero exit codes
- **Fallback behavior** (L403-421): Tests raw output return when version pattern not found

### setDefaultCommandFinder Tests (L424-440)
- **Global configuration**: Tests setting and restoring default command finder instances

## Key Mock Infrastructure

### Mocking Setup (L14-70)
- **Partial child_process mock** (L14-22): Preserves exec while mocking spawn
- **Environment variable management** (L29-70): Saves/restores pythonLocation variants
- **Default spawn behavior** (L44-53): Mock process with EventEmitter for validation

### MockCommandFinder Integration (L6, L25-70)
- Uses test utility for simulating command discovery
- Provides configurable responses for different Python executable searches
- Tracks call history for verification

## Critical Test Patterns

### Spawn Mock Configuration
- **Process simulation**: Uses EventEmitter to simulate child process behavior
- **Debugpy detection**: Special handling for debugpy import checks in spawn mocks
- **Platform-specific responses**: Different mock behaviors for Windows vs Unix platforms

### Environment Variable Testing
- Tests precedence: user-specified path > PYTHON_PATH > PYTHON_EXECUTABLE > platform defaults
- Windows-specific pythonLocation handling for GitHub Actions compatibility
- Proper cleanup to avoid cross-test pollution

## Dependencies
- **@debugmcp/adapter-python**: Core functions under test
- **MockCommandFinder**: Test utility for command discovery simulation
- **vitest**: Testing framework with comprehensive mocking capabilities
- **child_process**: Mocked for subprocess testing
- **node:fs/path**: File system operations for executable validation