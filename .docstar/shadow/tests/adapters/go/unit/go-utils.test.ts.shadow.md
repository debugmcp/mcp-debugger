# tests/adapters/go/unit/go-utils.test.ts
@source-hash: f1aa01c7fd325ca7
@generated: 2026-02-09T18:14:20Z

## Purpose
Unit test suite for Go toolchain utility functions in the DebugMCP Go adapter. Tests executable discovery, version parsing, and platform-specific path resolution functionality.

## Key Test Suites

### findGoExecutable Tests (L42-84)
Tests Go binary discovery logic with platform-aware behavior:
- Validates preferred path resolution (L47-54)
- Tests PATH environment variable scanning (L56-74) 
- Handles executable not found scenarios (L76-82)
- Only tests current platform to avoid unreliable cross-platform mocking (L44)

### findDelveExecutable Tests (L86-152)
Tests Delve debugger binary discovery:
- Validates preferred path resolution (L91-98)
- Tests GOPATH/bin directory scanning with platform-specific home paths (L100-140)
- Comprehensive environment variable cleanup in try/finally blocks (L126-139)
- Handles not found error cases (L142-150)

### Version Parsing Tests (L154-262)
**getGoVersion** (L154-216): Tests Go version extraction from `go version` command output
- Parses standard version format "go1.21.0" → "1.21.0" (L155-171)
- Handles minor-only versions "go1.22" → "1.22" (L173-189)
- Returns null on spawn errors (L191-202) and non-zero exit codes (L204-215)

**getDelveVersion** (L218-262): Tests Delve version extraction from `dlv version` output
- Parses "Version: 1.21.0" format (L219-235)
- Returns null on errors and failures (L237-261)

### DAP Support Detection (L264-303)
Tests `checkDelveDapSupport` function that validates Delve DAP (Debug Adapter Protocol) capability:
- Returns true on successful `dlv dap --help` execution (L265-276)
- Returns false on command failure (L278-289) or spawn errors (L291-302)

### Platform Path Resolution (L305-345)
Tests `getGoSearchPaths` with cross-platform mocking:
- Uses `describe.each` to test win32, linux, darwin platforms (L306)
- Validates platform-specific path patterns (L315-327)
- Tests GOBIN environment variable integration (L329-343)

## Test Infrastructure

### Mock Setup (L15-40)
- Mocks `child_process.spawn` using Vitest's `vi.mock` (L15-23)
- Creates mock logger with debug/info/error methods (L26, L30-34)
- Proper mock cleanup in beforeEach/afterEach hooks (L28-40)

### Process Emulation (L156-302)
Uses EventEmitter to simulate child processes:
- Mocks stdout/stderr streams as EventEmitters
- Uses `process.nextTick` for async event emission
- Simulates various exit codes and error scenarios

## Dependencies
- **Vitest**: Testing framework with mocking capabilities
- **Node.js modules**: child_process, fs, path, events
- **@debugmcp/adapter-go**: Target module under test

## Architecture Patterns
- **Platform-aware testing**: Only tests current platform for executable discovery to avoid flaky cross-platform mocks
- **Environment isolation**: Careful restoration of environment variables in try/finally blocks
- **Mock process simulation**: Comprehensive EventEmitter-based child process mocking
- **Error boundary testing**: Systematic testing of failure modes (spawn errors, non-zero exits)