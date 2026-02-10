# tests/core/unit/session/session-manager-paths.test.ts
@source-hash: 889a56fa4759a192
@generated: 2026-02-10T00:41:14Z

## Purpose
Unit test suite for SessionManager path resolution behavior across different operating systems and path formats. Tests Windows-specific path handling, relative/absolute path processing, and breakpoint file path normalization.

## Test Structure
- **Main Test Suite** (L9-137): Tests SessionManager path resolution capabilities
- **Setup/Teardown** (L14-32): Configures mock dependencies, fake timers, and test environment
- **Windows Path Handling** (L34-92): Tests Windows drive letters, backslash normalization, and path passthrough
- **Breakpoint Path Resolution** (L94-136): Tests relative paths, absolute paths, and cross-OS normalization

## Key Test Dependencies
- **SessionManager** (L5): Main class under test from session module
- **DebugLanguage.MOCK** (L6): Mock debug language for testing
- **createMockDependencies** (L7): Test utility for creating mock dependencies
- **Vitest Framework** (L4): Test runner with timing control

## Test Configuration
- **Base Config** (L17-23): Uses `/tmp/test-sessions` log directory with DAP launch args
- **Mock Dependencies** (L16, L31): ProxyManager reset in teardown
- **Timing Control** (L15, L29): Fake timers for controlled test execution

## Critical Test Behaviors
- **Path Passthrough** (L88-90, L104-105, L117-118): SessionManager now passes paths without modification
- **Windows Compatibility** (L41-54): Tests both backslash and forward slash Windows paths
- **Cross-Platform Normalization** (L127-134): Verifies mixed separator handling
- **Breakpoint Integration** (L48, L63, L82): Tests path handling through setBreakpoint method

## Architectural Notes
Comments indicate a shift in responsibility where SessionManager no longer performs path resolution - this is now handled at the server level (L89, L104). Tests verify passthrough behavior rather than normalization.