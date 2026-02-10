# packages/adapter-python/src/utils/python-utils.ts
@source-hash: 9de9510a811b02a6
@generated: 2026-02-10T00:41:18Z

## Purpose
Python executable detection utilities for the adapter-python package. Provides cross-platform Python discovery with Windows Store alias filtering, debugpy detection, and command-line tool resolution using the `which` library.

## Key Components

### Error Classes
- `CommandNotFoundError` (L23-30): Custom error for when commands cannot be found, extends Error with command property

### Interfaces & Types
- `Logger` (L10-13): Simple logging interface with error/debug methods, used throughout for diagnostic output
- `CommandFinder` (L32-34): Abstraction for command resolution with async find method
- `noopLogger` (L16-19): Default no-op logger implementation

### Core Classes
- `WhichCommandFinder` (L36-217): Main command finder implementation using `which` library
  - Caches results by default (L37-38)
  - Handles Windows PATH/Path case sensitivity issues (L50-98)
  - Filters Windows Store Python aliases using regex pattern (L100-114)
  - Extensive Windows-specific debugging and fallback logic (L45-216)
  - Attempts direct spawn testing when `which` fails (L175-212)

### Primary Functions
- `findPythonExecutable()` (L293-468): Main entry point for Python discovery
  - Priority order: preferred path → env vars → pythonLocation → auto-detect
  - Validates executables on Windows to avoid Store aliases (L339, L358, L395, L412)
  - Prefers Python installations with debugpy installed (L427-436)
  - Falls back to first valid Python if no debugpy found (L439-443)
  - Comprehensive error reporting with CI-specific logging (L449-462)

- `isValidPythonExecutable()` (L235-262): Validates Python executable by running import test
  - Detects Windows Store aliases by exit code 9009 and stderr patterns (L249-254)

- `hasDebugpy()` (L267-285): Checks if Python installation has debugpy package

- `getPythonVersion()` (L473-491): Extracts Python version string from --version output

### Utilities
- `setDefaultCommandFinder()` (L226-230): Dependency injection for testing
- `defaultCommandFinder` (L220): Global instance used by findPythonExecutable

## Dependencies
- `child_process.spawn`: Process execution for validation and version checks
- `which`: Cross-platform command resolution
- `node:fs`, `node:path`: File system operations

## Architecture Patterns
- **Strategy Pattern**: CommandFinder interface allows pluggable command resolution
- **Caching**: WhichCommandFinder caches resolved paths for performance
- **Graceful Degradation**: Multiple fallback strategies for Python discovery
- **Platform Abstraction**: Extensive Windows-specific handling while maintaining cross-platform compatibility

## Critical Behaviors
- Windows Store Python aliases are actively filtered out (shimPattern L100)
- Environment variables PATH/Path are normalized on Windows (L92-97)
- ComSpec/COMSPEC fallback prevents which library failures on Windows (L51-59)
- debugpy presence influences Python selection priority but isn't required
- Verbose discovery mode via DEBUG_PYTHON_DISCOVERY environment variable

## Error Handling
- CommandNotFoundError for missing commands
- Graceful fallbacks through multiple discovery strategies
- Comprehensive error reporting in CI environments
- Direct spawn testing when which library fails