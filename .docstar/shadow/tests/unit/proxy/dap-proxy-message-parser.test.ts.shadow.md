# tests/unit/proxy/dap-proxy-message-parser.test.ts
@source-hash: 152720444bae9978
@generated: 2026-02-10T00:41:38Z

## Purpose
Unit test suite for MessageParser class, validating command parsing and validation logic for DAP (Debug Adapter Protocol) proxy message handling. Tests parsing from both objects and JSON strings, validation of different payload types (init, dap, terminate), and error handling.

## Test Structure
- **Main describe block** (L13): MessageParser test suite
- **parseCommand tests** (L14-98): Validates command parsing functionality
- **validateInitPayload tests** (L100-232): Tests initialization payload validation
- **validateDapPayload tests** (L234-289): Tests DAP command payload validation  
- **validateTerminatePayload tests** (L291-311): Tests termination payload validation
- **Helper function tests** (L313-320): Tests utility methods

## Dependencies
- **Testing framework**: vitest (describe, it, expect) (L5)
- **Source module**: MessageParser from dap-proxy-message-parser.js (L6)
- **Type interfaces**: ProxyInitPayload, DapCommandPayload, TerminatePayload (L7-11)

## Key Test Categories

### Command Parsing Tests (L15-97)
- Object parsing (L15-29): Valid init command from object
- JSON string parsing (L31-44): Valid init command from JSON string
- DAP command parsing (L46-58): Valid dap command with requestId and dapArgs
- Terminate command parsing (L60-69): Basic terminate command
- Error cases (L71-96): Invalid JSON, wrong types, missing fields, unknown commands

### Init Payload Validation (L101-231)
- Complete payload (L101-122): All optional fields included (scriptArgs, stopOnEntry, justMyCode, dryRunSpawn, initialBreakpoints)
- Minimal payload (L124-137): Only required fields
- Required field validation (L139-159): Tests sessionId, executablePath, adapterHost, logDir, scriptPath
- Port validation (L161-178): Invalid adapterPort values (0, -1, 65536, non-numbers)
- Optional field type validation (L180-204): Wrong types for scriptArgs, boolean flags, etc.
- Breakpoint validation (L206-231): Invalid breakpoint objects missing file/line or wrong types

### DAP Payload Validation (L235-288)
- Complete/minimal payloads (L235-258): With and without dapArgs
- Required field validation (L260-275): sessionId, requestId, dapCommand
- Null dapArgs handling (L277-288): Explicit null rejection

### Terminate Payload Validation (L291-310)
- Standard validation (L292-300): Normal terminate with sessionId
- Emergency shutdown (L302-310): Allows missing sessionId for emergency cases

### Helper Functions (L314-319)
- isStringMessage utility testing: Type checking for string messages

## Test Data Patterns
- **Init commands**: Include Python debugger setup (executablePath: '/usr/bin/python3', scriptPath, adapterHost/Port)
- **DAP commands**: Use 'continue' command with threadId args
- **Session management**: Consistent 'test-session' sessionId pattern
- **Error validation**: Comprehensive edge case coverage including type mismatches and boundary conditions

## Notable Testing Strategies
- Parameterized testing for required fields validation (L144-158, L263-274)
- Comprehensive invalid input testing for port ranges and type validation
- Emergency shutdown scenario testing (sessionId optional for terminate)
- Both positive and negative test cases for all validation methods