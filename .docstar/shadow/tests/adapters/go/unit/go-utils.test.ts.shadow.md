# tests/adapters/go/unit/go-utils.test.ts
@source-hash: f1aa01c7fd325ca7
@generated: 2026-02-10T00:41:18Z

## Purpose and Responsibility

Unit test suite for the Go utilities module of the debugmcp Go adapter. Tests executable discovery, version parsing, and platform-specific path resolution for Go and Delve debugger tools.

## Key Test Suites and Functions

### Test Setup (L1-41)
- Imports vitest testing framework and mocks `child_process.spawn` for process isolation
- Mock logger setup with debug/info/error methods (L26)
- Global mocks cleanup in afterEach hooks (L37-40)

### findGoExecutable Tests (L42-84)
- Tests Go executable discovery on current platform only (L44)
- Validates preferred path resolution (L47-54)
- Tests PATH environment variable scanning (L56-74)
- Ensures proper error handling when Go not found (L76-82)

### findDelveExecutable Tests (L86-152)
- Tests Delve debugger executable discovery on current platform (L88)
- Validates custom path preference (L91-98)
- Tests GOPATH/bin discovery with cross-platform home directory handling (L100-140)
- Comprehensive environment variable cleanup in try-finally blocks
- Error handling for missing Delve executable (L142-150)

### Version Parsing Tests

#### getGoVersion Tests (L154-216)
- Mock spawn implementation using EventEmitter pattern (L156-167)
- Tests standard version format parsing "go1.21.0" → "1.21.0" (L155-171)
- Tests minor-only version format "go1.22" → "1.22" (L173-189)
- Error handling for spawn failures and non-zero exit codes (L191-215)

#### getDelveVersion Tests (L218-262)
- Tests Delve version string extraction from multi-line output (L219-235)
- Error handling for spawn and exit code failures (L237-261)

### checkDelveDapSupport Tests (L264-303)
- Tests DAP (Debug Adapter Protocol) support detection via `dlv dap --help`
- Success/failure detection based on exit codes (L265-289)
- Spawn error handling (L291-302)

### getGoSearchPaths Tests (L305-345)
- Cross-platform testing using parameterized describe blocks (L306)
- Platform stubbing with vi.stubGlobal (L308)
- Validates platform-specific path generation for Windows, Linux, Darwin
- Tests GOBIN environment variable integration (L329-343)

## Dependencies and Relationships

- **@debugmcp/adapter-go**: Source module containing utilities being tested
- **vitest**: Testing framework with mocking capabilities
- **child_process**: Mocked for process spawning isolation
- **node:fs**: File system access mocking
- **events.EventEmitter**: Process simulation in tests

## Testing Patterns and Architecture

- **Platform-aware testing**: Only tests current platform to avoid cross-platform mocking complexity
- **Environment isolation**: Comprehensive env var backup/restore in try-finally blocks
- **Process mocking**: EventEmitter-based spawn mocking with async event emission
- **Error boundary testing**: Systematic testing of failure modes and error conditions

## Critical Test Constraints

- Tests run only on current platform (`process.platform`) to avoid unreliable cross-platform mocking
- Mock processes use `process.nextTick()` for async event simulation
- Environment variable modifications require careful cleanup to prevent test pollution