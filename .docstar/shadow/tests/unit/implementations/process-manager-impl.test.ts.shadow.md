# tests/unit/implementations/process-manager-impl.test.ts
@source-hash: 84b7a5b0c7f657ae
@generated: 2026-02-09T18:14:44Z

## Primary Purpose
Unit test file for ProcessManagerImpl class that validates edge cases in process spawning and execution, particularly focusing on how Node.js `util.promisify` behaves across different versions and return types.

## Test Architecture & Global Mock Control System
- Uses sophisticated global variable system to control `util.promisify` behavior (L10-11, L49-51, L57-58)
- Global variables `__promisifyResult` and `__promisifyBehavior` manipulate mock responses
- Mocks `child_process` (spawn, exec) and `util` (promisify) modules (L14-34)
- Custom promisify mock dynamically returns/throws based on global state (L20-33)

## Key Test Suites

### ProcessManager.spawn Tests (L61-104)
- Basic spawn functionality with command, args, and options (L62-76)
- Spawn without options parameter (L78-86) 
- Error handling for invalid commands (L88-92)
- Default empty args handling when not provided (L94-103)

### ProcessManager.exec Tests (L106-234)
Complex testing of promisify return value variations:

#### Standard Return Types:
- Object with stdout/stderr properties (L107-120)
- Array format [stdout, stderr] (L122-132)  
- String-only output (L134-144)
- Empty array handling (L194-204)

#### Edge Cases & Fallbacks:
- Unexpected return types with console warnings (L146-160)
- Null return values (L162-176)
- Objects without stdout/stderr properties (L178-192)
- Error handling and rejection scenarios (L206-212)
- Non-zero exit codes with partial output (L214-233)

## Test Infrastructure
- **Setup/Teardown**: Mock clearing, console.warn spy, global variable management (L44-59)
- **Mock Dependencies**: spawn, exec from child_process; promisify from util
- **Error Validation**: Tests both thrown errors and structured error objects with exit codes

## Critical Testing Patterns
- Tests reference specific line numbers in source code (comments like "line 22", "line 27")
- Validates console warning behavior for unexpected promisify return types
- Comprehensive coverage of Node.js exec callback transformation edge cases
- Maintains clean global state between tests to prevent interference