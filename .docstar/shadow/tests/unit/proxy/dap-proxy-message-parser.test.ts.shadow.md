# tests/unit/proxy/dap-proxy-message-parser.test.ts
@source-hash: 152720444bae9978
@generated: 2026-02-09T18:14:45Z

## Purpose
Unit test suite for `MessageParser` class that validates and parses DAP (Debug Adapter Protocol) proxy commands. Tests command parsing, validation logic, and error handling for three command types: init, dap, and terminate.

## Test Structure
- **parseCommand tests (L14-98)**: Validates JSON/object parsing and command routing
- **validateInitPayload tests (L100-232)**: Tests init command validation with required/optional fields
- **validateDapPayload tests (L234-289)**: Tests DAP command validation
- **validateTerminatePayload tests (L291-311)**: Tests terminate command validation
- **Helper function tests (L313-320)**: Tests utility methods

## Key Dependencies
- **Testing framework**: vitest (L5)
- **Under test**: `MessageParser` from `dap-proxy-message-parser.js` (L6)
- **Type imports**: `ProxyInitPayload`, `DapCommandPayload`, `TerminatePayload` (L7-11)

## Test Coverage Areas

### Command Parsing (L15-97)
- Valid object and JSON string parsing (L15-44)
- Command type routing for init/dap/terminate (L46-69)
- Error handling for invalid JSON, wrong types, missing fields (L71-96)

### Init Payload Validation (L101-231)
- Complete payload with all optional fields (L101-122)
- Minimal required-only payload (L124-137)
- Required field validation: sessionId, executablePath, adapterHost, logDir, scriptPath (L139-159)
- Port number validation (1-65535 range) (L161-178)
- Optional field type validation: scriptArgs, stopOnEntry, justMyCode, dryRunSpawn, initialBreakpoints (L180-204)
- Breakpoint object validation with file/line/condition fields (L206-231)

### DAP Command Validation (L235-288)
- Required fields: sessionId, requestId, dapCommand (L260-275)
- Optional dapArgs object validation (null rejection) (L277-288)

### Terminate Command (L292-310)
- Standard validation with sessionId (L292-300)
- Emergency shutdown support (sessionId optional) (L302-310)

## Error Message Patterns
Tests verify specific error messages for different validation failures:
- JSON parsing: "Failed to parse JSON message"
- Type validation: "Invalid message type"
- Missing fields: "missing or invalid 'fieldName'"
- Port validation: "invalid 'adapterPort'"
- Breakpoint validation: "/Breakpoint/" regex pattern

## Notable Test Patterns
- Uses `forEach` loops to test multiple invalid values systematically (L144-158, L164-177, L189-203)
- Tests both positive (valid) and negative (invalid) cases for each validation method
- Employs type assertion (`as any`) to test invalid field types (L145, L170)