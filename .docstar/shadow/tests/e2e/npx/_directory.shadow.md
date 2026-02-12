# tests/e2e/npx/
@generated: 2026-02-11T23:47:42Z

## NPX End-to-End Test Suite

**Primary Purpose**: Comprehensive end-to-end testing of the MCP debugger's npm package distribution via `npx`. This test directory validates that the MCP debugger works correctly when installed and executed as a globally distributed npm package, ensuring critical functionality like language adapter inclusion and complete debugging workflows function properly in real-world usage scenarios.

## Key Components & Architecture

### Test Infrastructure (`npx-test-utils.ts`)
Core testing infrastructure providing sophisticated package management and client connection capabilities:

- **Build Pipeline**: Automated workspace building, npm packaging with content fingerprinting and caching
- **Lock-based Coordination**: File-based mutex system preventing concurrent packaging operations  
- **Global Installation Management**: Handles npm global install/uninstall with verification
- **MCP Client Factory**: Creates MCP clients connected to globally-installed packages with comprehensive logging
- **Package Analysis**: Tarball size metrics and content verification for required adapters

### Language-Specific Test Suites

#### JavaScript Testing (`npx-smoke-javascript.test.ts`)
- **Critical Fix Validation**: Ensures JavaScript adapter is properly included in npm package distribution
- **Complete Debugging Workflow**: Tests session creation, breakpoints, variable inspection, stepping, and cleanup
- **Real Script Execution**: Uses `examples/javascript/simple_test.js` for authentic debugging scenarios

#### Python Testing (`npx-smoke-python.test.ts`)  
- **Python Debugging Validation**: Full Python debugging workflow through npm package distribution
- **8-Step Debug Sequence**: Comprehensive testing of session lifecycle, breakpoints, variable inspection, and execution control
- **Variable State Verification**: Tests variable modifications during debug stepping with `examples/python/simple_test.py`

## Public API & Entry Points

### Primary Test Utilities
- `buildAndPackNpmPackage()`: Main orchestration function for building and packaging
- `installPackageGlobally(tarballPath)`: Global npm installation with verification
- `createNpxMcpClient()`: MCP client factory for global package connections
- `cleanupGlobalInstall()`: Clean removal of globally installed test packages

### Test Configuration
- `NpxTestConfig`: Configurable testing parameters (package paths, global vs local, logging)
- Sequential test execution to prevent npm package conflicts
- Comprehensive timeout management (240s setup, 120s execution)

## Data Flow & Test Orchestration

1. **Build Phase**: Content fingerprinting → workspace building → npm packing → caching
2. **Installation Phase**: Global npm installation → verification → MCP client creation
3. **Testing Phase**: Language support validation → complete debugging workflow testing
4. **Cleanup Phase**: Debug session closure → global package removal → resource cleanup

## Internal Organization

### Caching Strategy
- SHA-256 content fingerprinting of `package.json` and `dist/` directory
- Cached tarballs stored in `.pack-cache/` to optimize repeated test runs
- Intelligent cache invalidation based on content changes

### State Management
- **Session Tracking**: Debug session IDs managed across test lifecycle
- **Resource Cleanup**: Multi-layered cleanup (afterEach, afterAll) prevents resource leaks
- **Lock Management**: File-based locking prevents concurrent packaging operations

### Logging & Diagnostics
- **MCP Communication Logging**: Instrumented `callTool` calls with request/response details
- **Package Metrics**: Size analysis and content verification reporting
- **Debug Output**: Comprehensive logging for troubleshooting test failures

## Key Patterns & Conventions

- **Sequential Test Execution**: Prevents race conditions in global npm operations
- **Defensive Cleanup**: Try-catch blocks in cleanup prevent cascade failures
- **Real-world Simulation**: Uses actual npm global installation rather than mocks
- **Stabilization Delays**: Strategic timeouts for debug adapter protocol state transitions
- **Content Verification**: Validates required language adapters (JavaScript, Python, Mock) in built packages

This directory serves as the authoritative validation suite for npm package distribution, ensuring the MCP debugger maintains full functionality when distributed and consumed through standard npm/npx channels.