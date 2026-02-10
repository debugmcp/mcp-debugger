# packages/adapter-python/tests/unit/python-utils.comprehensive.test.ts
@source-hash: 617edf2a0d91327a
@generated: 2026-02-09T18:14:20Z

**Comprehensive Test Suite for Python Discovery Utilities**

Tests the `python-utils.js` module's Python executable discovery functionality across platforms with extensive edge case coverage and mocking.

## Key Test Components

### Mock Infrastructure (L6-58)
- **Child Process Mock** (L7-11): Mocks `child_process.spawn` for controlled process simulation
- **Which Library Mock** (L14-16): Mocks `which` command lookup utility  
- **Process Mock Factory** `createSpawn()` (L37-58): Creates EventEmitter-based mock processes with configurable exit codes, stdout/stderr, and errors

### Core Test Categories

#### CommandNotFoundError Tests (L63-76)
- Validates custom error class with `command` property
- Tests inheritance from base Error class

#### Command Finder Configuration (L78-96)
- Tests `setDefaultCommandFinder()` function for swapping discovery strategies
- Validates return of previous finder when setting new one

#### Platform-Specific Windows Behavior (L110-248)
- **Path Normalization** (L111-130): Tests `Path` to `PATH` environment variable conversion
- **Windows Store Alias Filtering** (L132-154): Filters out Microsoft Store Python stubs
- **Extension Handling** (L156-183): Tests `.exe` extension handling on Windows
- **Debug Discovery Logging** (L185-215): Verbose logging when `DEBUG_PYTHON_DISCOVERY=true`
- **Store Alias Detection** (L217-247): Detects Windows Store aliases via stderr content

#### Environment Variable Handling (L250-325)
- **PYTHON_EXECUTABLE** (L251-268): Direct executable path specification
- **PythonLocation** (L270-296): Windows-specific Python installation root
- **pythonLocation** (L298-324): Unix-style installation root with `bin/` subdirectory

#### Preferred Path Parameter (L327-399)
- Tests custom Python executable preference
- Validates fallback to auto-discovery when preferred path invalid
- Error propagation for non-CommandNotFoundError exceptions

#### Debugpy Preference Logic (L401-470)
- **Multi-Python Selection** (L402-440): Prefers Python installations with debugpy module
- **Fallback Strategy** (L442-469): Returns first valid Python when none have debugpy

#### Error Scenarios (L472-509)
- **Comprehensive Error Messages** (L473-488): Lists tried paths in failure messages
- **CI Environment Logging** (L490-508): Enhanced failure logging in CI environments

### Python Version Detection Tests (L512-574)
- Tests `getPythonVersion()` function with various output formats
- Handles version parsing from stdout/stderr
- Error handling for spawn failures and non-zero exits

### Advanced Discovery Behavior (L576-908)
- **Spawn Error Handling** (L588-614): Graceful handling of process spawn errors during debugpy checks
- **Debug Message Logging** (L616-640): Verification of discovery debug messages
- **Complex Validation Scenarios** (L642-756): Multiple validation attempts and Windows Store detection
- **Auto-detect Loop Error Handling** (L770-793): Error recovery during candidate iteration

### Verbose Discovery Logging (L910-1069)
- **Windows Debug Output** (L922-963): Comprehensive logging on Windows with DEBUG flag
- **PATH Issue Detection** (L965-996): Logs PATH configuration problems  
- **Python PATH Entries** (L998-1030): Lists discovered Python installations in PATH
- **CI Failure Logging** (L1032-1068): Detailed failure information in CI environments

## Key Dependencies
- **vitest**: Test framework with mocking capabilities
- **node:events**: EventEmitter for process simulation
- **node:path**: Path manipulation utilities
- **node:fs**: File system existence checks
- **child_process**: Process spawning (mocked)
- **which**: Command lookup utility (mocked)

## Testing Patterns
- Extensive platform mocking (`process.platform`, environment variables)
- Process behavior simulation with configurable outcomes
- Error injection and recovery testing
- Debug/verbose logging verification
- Cross-platform compatibility validation