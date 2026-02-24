# tests\adapters\go\unit\go-utils.test.ts
@source-hash: dedf7c3621db541c
@generated: 2026-02-24T01:54:15Z

## Purpose
Unit test suite for Go development utilities, testing executable discovery, version detection, and DAP support validation functions from the `@debugmcp/adapter-go` package.

## Test Structure
- **Test Suite Setup (L25-40)**: Main describe block with beforeEach/afterEach hooks for mock management
- **Mock Configuration (L15-23)**: Mocks `child_process.spawn` using Vitest for process execution testing
- **Mock Logger (L26, L30-34)**: Creates stub logger with debug/info/error methods for testing

## Key Test Groups

### findGoExecutable Tests (L42-89)
Tests Go executable discovery logic on current platform only:
- **Preferred Path Test (L47-54)**: Validates custom path preference when file exists
- **PATH Search Test (L56-74)**: Tests fallback to PATH environment variable search
- **Not Found Error Test (L76-87)**: Validates error throwing when executable missing

### findDelveExecutable Tests (L91-166)
Tests Delve debugger executable discovery:
- **Preferred Path Test (L96-103)**: Similar to Go executable preferred path logic
- **GOPATH/bin Search Test (L105-145)**: Complex test with extensive environment variable manipulation
- **Not Found Error Test (L147-164)**: Error case validation

### getGoVersion Tests (L168-230)
Tests Go version string extraction from `go version` command:
- **Standard Version Parsing (L169-185)**: Parses "go1.21.0" format to "1.21.0"
- **Minor-Only Version Parsing (L187-203)**: Handles "go1.22" format
- **Error Handling (L205-229)**: Tests spawn errors and non-zero exit codes

### getDelveVersion Tests (L232-276)
Tests Delve version extraction from `dlv version` command:
- **Version Parsing (L233-249)**: Extracts version from multi-line output
- **Error Cases (L251-275)**: Spawn errors and exit code failures

### checkDelveDapSupport Tests (L278-318)
Tests DAP (Debug Adapter Protocol) support detection:
- **Supported Case (L279-290)**: Success when `dlv dap --help` exits 0
- **Unsupported Cases (L292-317)**: Failure scenarios and error message capture

### getGoSearchPaths Tests (L320-360)
Cross-platform path generation testing:
- **Platform-Specific Paths (L321-342)**: Uses `describe.each` for win32/linux/darwin testing
- **GOBIN Integration (L344-358)**: Tests custom GOBIN environment variable handling

## Testing Patterns
- **Environment Variable Management**: Extensive save/restore patterns for PATH, GOPATH, GOBIN, HOME, USERPROFILE
- **Process Mocking**: EventEmitter-based mock processes with stdout/stderr simulation
- **Platform Awareness**: Tests adapt behavior based on `process.platform` for cross-platform compatibility
- **Async Process Testing**: Uses `process.nextTick()` for asynchronous event emission simulation

## Key Dependencies
- **Vitest Framework**: Primary testing framework with mocking capabilities
- **Node.js Built-ins**: `child_process`, `fs`, `path`, `events` for system interaction
- **@debugmcp/adapter-go**: Target module containing utility functions under test