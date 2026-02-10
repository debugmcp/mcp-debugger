# packages/adapter-python/src/utils/python-utils.ts
@source-hash: 9de9510a811b02a6
@generated: 2026-02-09T18:14:13Z

## Purpose

Python executable discovery utility for Node.js applications, specifically designed for cross-platform Python detection with Windows compatibility focus. Handles Windows Store alias filtering, debugpy detection, and provides robust command finding with extensive diagnostics.

## Key Architecture

### Command Finding Interface (L32-34)
- `CommandFinder` interface abstracts executable discovery
- Enables dependency injection for testing
- `WhichCommandFinder` (L36-217) is the primary implementation using the 'which' library

### Error Handling (L23-30)
- `CommandNotFoundError` extends Error with command context
- Custom error type for cleaner error handling in calling code

### Core Discovery Logic (L293-468)
`findPythonExecutable()` implements multi-stage Python discovery:
1. User-specified preferred path (L335-350)
2. Environment variables: PYTHON_PATH, PYTHON_EXECUTABLE (L353-369)
3. GitHub Actions pythonLocation support (L372-400)
4. Auto-detection via common commands (L407-424)
5. debugpy availability check (L428-436)
6. Fallback to first valid Python (L439-443)

### Windows-Specific Features

#### Store Alias Filtering (L100-114)
- Detects and filters Windows Store Python aliases via regex pattern
- Prevents selection of non-functional Microsoft Store shortcuts
- Pattern: `/\\microsoft\\windowsapps\\(python(\d+)?|py)\.exe$/`

#### Path Environment Fixes (L48-98)
- Handles Windows case-sensitive PATH vs Path environment variable issues
- Sets ComSpec fallbacks for cmd.exe discovery
- Extensive diagnostics when DEBUG_PYTHON_DISCOVERY=true

### Validation Functions

#### `isValidPythonExecutable()` (L235-262)
- Spawns Python with test command to verify functionality
- Detects Windows Store aliases by exit code 9009 and stderr patterns
- Returns boolean validity status

#### `hasDebugpy()` (L267-285)
- Tests for debugpy module availability via import test
- Used to prioritize Python installations with debugging support

#### `getPythonVersion()` (L473-491)
- Extracts version string from `python --version`
- Handles both stdout and stderr output
- Returns semantic version or null

## Dependencies
- `which`: Primary executable discovery mechanism
- `child_process.spawn`: Python validation and version detection
- `node:fs`, `node:path`: File system operations

## Configuration
- Environment variables: PYTHON_PATH, PYTHON_EXECUTABLE, pythonLocation
- Debug mode: DEBUG_PYTHON_DISCOVERY=true enables verbose logging
- Platform detection: process.platform === 'win32'

## Caching
- `WhichCommandFinder` includes LRU-style Map cache (L37)
- Cache can be disabled via constructor parameter
- `setDefaultCommandFinder()` (L226-230) allows test overrides

## Error Recovery
- Multi-candidate resolution with Set deduplication (L135-149)
- Graceful degradation when debugpy not available
- Comprehensive error messages with tried paths listing (L464-467)

## Logging
- Local Logger interface (L10-13) for decoupled logging
- Extensive CI diagnostics when in verbose mode
- JSON structured logging for automated analysis