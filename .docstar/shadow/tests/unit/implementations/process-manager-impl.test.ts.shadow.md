# tests/unit/implementations/process-manager-impl.test.ts
@source-hash: 9047a770380a7a3c
@generated: 2026-02-10T01:18:53Z

## Purpose
Unit test file for ProcessManagerImpl focusing on edge cases in util.promisify behavior across Node.js versions. Tests both spawn and exec methods with comprehensive mocking strategies.

## Architecture & Testing Strategy
- Uses Vitest framework with comprehensive mocking (L7)
- Mocks child_process (L10-13) and util (L15-30) modules at module level
- Implements custom promisify mock with global state control via `__promisifyBehavior` and `__promisifyResult` (L21-22)
- Setup/teardown manages mock state and console spying (L40-55)

## Key Test Suites

### Spawn Tests (L57-100)
Tests ProcessManagerImpl.spawn() method covering:
- Basic spawn with command, args, and options (L58-72)
- Spawn without options (L74-82) 
- Error handling for invalid commands (L84-88)
- Default empty args parameter (L90-99)

### Exec Tests (L102-230)
Comprehensive testing of ProcessManagerImpl.exec() method addressing util.promisify variations:
- Object return with stdout/stderr properties (L103-116)
- Array return [stdout, stderr] format (L118-128) 
- String-only return (L130-140)
- Unexpected type handling with console warnings (L142-156)
- Null return fallback (L158-172)
- Object without stdout/stderr properties (L174-188)
- Empty array handling (L190-200)
- Error rejection scenarios (L202-208)
- Error objects with exit codes and partial output (L210-229)

## Key Implementation Details
- Global state variables control promisify mock behavior for isolated test scenarios
- Console.warn spy captures warning messages for unexpected return types (L43, L149-151)
- Mock process objects include standard properties (pid, stdout, stderr, on, kill) for realistic testing
- Error objects include code, stdout, stderr properties for comprehensive error handling validation

## Dependencies
- vitest testing framework
- Mocked child_process (spawn, exec)
- Mocked util.promisify with custom behavior control
- ProcessManagerImpl from implementations directory (L33)