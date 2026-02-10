# tests/core/unit/session/session-manager-paths.test.ts
@source-hash: 889a56fa4759a192
@generated: 2026-02-09T18:14:26Z

## Primary Purpose
Test suite validating SessionManager's path resolution behavior across different operating systems and path formats. Focuses on ensuring paths are handled correctly when setting breakpoints, particularly for Windows/Unix path separators and absolute/relative path handling.

## Key Test Structure
- **Main describe block** (L9-137): "SessionManager - Path Resolution" 
- **Setup/teardown** (L14-32): Configures fake timers, mock dependencies, and SessionManager instance with test config
- **Windows Path Handling** (L34-92): Tests Windows-specific path scenarios with drive letters and backslashes
- **Breakpoint Path Resolution** (L94-136): Tests general path handling for breakpoints

## Critical Test Cases
- **Windows absolute paths** (L35-55): Validates handling of `C:\Users\test\file.py` and mixed separator formats
- **Backslash normalization** (L57-73): Tests conversion of `src\debug\file.py` format
- **Path pass-through behavior** (L75-91): Verifies paths are passed without modification
- **Relative path handling** (L95-106): Tests `src/test.py` style paths
- **Mixed separator normalization** (L121-135): Tests `src\components/test.py` format

## Dependencies
- **SessionManager** (L5): Core class under test from `../../../../src/session/session-manager.js`
- **DebugLanguage.MOCK** (L6): Test language enum from `@debugmcp/shared`
- **createMockDependencies** (L7): Test utilities from local test utils

## Test Configuration
- **logDirBase**: `/tmp/test-sessions` (L18)
- **defaultDapLaunchArgs**: stopOnEntry and justMyCode flags (L19-22)
- **Language**: Always uses DebugLanguage.MOCK for consistency
- **Python path**: Generic 'python' string

## Architecture Notes
Tests validate that SessionManager now adopts a "pass-through" approach for path handling rather than performing normalization internally. Path resolution responsibility has been moved to server level (L89). All assertions verify the breakpoint file property matches input paths exactly, indicating minimal path transformation at this layer.