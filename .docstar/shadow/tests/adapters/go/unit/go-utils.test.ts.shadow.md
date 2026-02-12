# tests\adapters\go\unit\go-utils.test.ts
@source-hash: a12c779cb87af9f5
@generated: 2026-02-12T21:00:35Z

## Purpose
Unit test suite for Go development tools utilities, validating executable discovery, version parsing, and platform-specific path resolution functionality in the Go adapter module.

## Test Structure & Coverage

### Core Test Suites
- **findGoExecutable tests (L42-89)**: Tests Go executable discovery across platforms
  - Preferred path validation (L47-54)
  - PATH environment scanning (L56-74)
  - Error handling when not found (L76-87)
- **findDelveExecutable tests (L91-166)**: Tests Delve debugger executable discovery
  - Custom path preference (L96-103)
  - GOPATH/bin fallback logic (L105-145)
  - Error scenarios (L147-164)
- **Version parsing tests (L168-276)**:
  - **getGoVersion (L168-230)**: Parses `go version` output with various formats
  - **getDelveVersion (L232-276)**: Extracts version from Delve output
- **checkDelveDapSupport tests (L278-317)**: Validates DAP protocol support
- **getGoSearchPaths tests (L319-359)**: Cross-platform path resolution testing

### Test Infrastructure
- **Mock setup (L15-24)**: Mocks `child_process.spawn` for process execution testing
- **Logger mocking (L26-40)**: Creates mock logger with debug/info/error methods
- **Platform-aware testing (L44, L93, L320)**: Tests current platform only to avoid unreliable cross-platform mocking

### Key Testing Patterns
- **Process mocking**: Uses EventEmitter to simulate child processes with stdout/stderr
- **Environment manipulation**: Temporarily modifies PATH, GOPATH, GOBIN for isolated testing
- **Cross-platform paths**: Platform-specific executable extensions (.exe on Windows)
- **Error simulation**: Tests spawn failures and non-zero exit codes

### Dependencies
- Imports utilities from `@debugmcp/adapter-go` (L6-13)
- Uses Vitest framework with extensive mocking capabilities
- Node.js built-ins: `fs`, `path`, `child_process`, `events`

### Critical Test Behaviors
- Environment restoration in finally blocks to prevent test pollution
- Platform detection using `process.platform` 
- Mock process stdout/stderr data emission timing with `process.nextTick`
- Version string parsing validation for both full (1.21.0) and partial (1.22) formats