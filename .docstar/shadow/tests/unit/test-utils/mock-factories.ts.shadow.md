# tests/unit/test-utils/mock-factories.ts
@source-hash: af90b2f631182194
@generated: 2026-02-10T00:41:40Z

## Purpose
Test utility factory functions for creating properly configured mocks of core system components. Ensures consistent mock behavior across test suites by providing standardized mock implementations with all required properties and sensible default return values.

## Key Factories

### Process Mocks
- **createMockChildProcess()** (L15-38): Creates fully-featured ChildProcess mock with EventEmitter inheritance, all standard properties (stdin/stdout/stderr, pid, connected state), and mocked methods (send, kill, ref, unref, disconnect)
- **createMockProxyProcess()** (L43-54): Simplified process mock with EventEmitter base, custom methods (send, sendCommand, kill), and basic I/O streams
- **createPythonValidationProcess()** (L186-195): Pre-configured child process that automatically emits successful exit (code 0) on next tick
- **createFailedPythonValidationProcess()** (L200-209): Pre-configured child process that automatically emits failed exit (code 1) on next tick

### Service Mocks
- **createMockSessionManager()** (L59-105): Comprehensive debugging session manager mock with all session lifecycle methods, debugging operations (breakpoints, stepping, variable inspection), and consistent success responses
- **createMockAdapterRegistry()** (L110-122): Language adapter registry mock supporting Python/mock languages with standard adapter management methods
- **createMockWhichFinder()** (L127-131): Command finder utility that always resolves to '/usr/bin/python3'
- **createMockNetworkManager()** (L167-171): Network utilities mock that returns port 12345 for free port requests

### Infrastructure Mocks
- **createMockLogger()** (L136-143): Standard logging interface with debug/info/warn/error methods
- **createMockFileSystem()** (L148-162): File system operations mock with directory/file management and stat functionality, defaults to file existence and basic stat properties
- **createMockEnvironment()** (L176-181): Environment detection mock with non-container defaults

## Dependencies
- **vitest**: Mock function creation (vi.fn())
- **events.EventEmitter**: Event-driven mock implementations
- **child_process.ChildProcess**: Type definitions for process mocks

## Patterns
- All mocks return success-oriented defaults to enable positive test paths
- EventEmitter inheritance used for process and stream mocks
- Consistent return value patterns: async operations return `{ success: true }` objects
- Hard-coded but realistic default values (PIDs, ports, paths)
- Method chaining support where appropriate (ref/unref return `this`)

## Critical Details
- Process mocks use nextTick for async exit simulation to avoid immediate synchronous completion
- All vi.fn() mocks are properly configured with return values to prevent undefined behavior
- SessionManager mock provides comprehensive debugging API coverage
- FileSystem mock defaults assume file existence and read success for positive testing