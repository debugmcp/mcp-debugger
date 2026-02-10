# tests/e2e/npx/
@generated: 2026-02-10T01:19:42Z

## NPX E2E Test Suite - MCP Debugger Distribution Validation

### Overall Purpose
This directory contains a comprehensive end-to-end test suite that validates the MCP debugger's distribution and functionality when installed and executed via `npx`. The tests ensure that the npm package distribution mechanism works correctly and that core debugging features function properly across multiple programming languages (JavaScript and Python) when accessed through the global npm installation pathway.

### Key Components and Organization

**Test Orchestration Layer**:
- `npx-test-utils.ts`: Core infrastructure providing build automation, package management, and MCP client creation
- Handles npm package building, caching, global installation, and cleanup operations
- Implements process-safe concurrency controls and error-resilient cleanup patterns

**Language-Specific Test Suites**:
- `npx-smoke-javascript.test.ts`: Validates JavaScript debugging workflow via npx
- `npx-smoke-python.test.ts`: Validates Python debugging workflow via npx
- Both follow identical test patterns: language support verification + complete debugging cycle validation

### Public API Surface

**Primary Entry Points**:
- `buildAndPackNpmPackage()`: Builds and caches npm package tarball with fingerprint-based optimization
- `installPackageGlobally()` / `cleanupGlobalInstall()`: Global npm package lifecycle management
- `createNpxMcpClient()`: Creates MCP SDK client instances that execute via npx with transport logging
- `getPackageSize()` / `verifyPackageContents()`: Package validation and metrics utilities

**Test Configuration**:
- `NpxTestConfig`: Optional configuration for package paths, global installation flags, and logging levels
- Configurable timeouts (240s setup, 120s execution) for CI/CD environments

### Internal Data Flow

1. **Package Preparation Phase**: 
   - Acquire process lock → Build workspace → Create package backup → Generate npm tarball → Cache by fingerprint
   
2. **Global Installation Phase**:
   - Install tarball globally → Verify installation → Create npx-based MCP client with transport logging

3. **Test Execution Phase**:
   - Validate language support → Execute complete debugging workflow (session creation, breakpoints, variable inspection, stepping, cleanup)

4. **Cleanup Phase**:
   - Close debug sessions → Cleanup MCP connections → Remove global installations → Release locks

### Important Patterns and Conventions

**Concurrency Safety**:
- Process-safe locking mechanism prevents parallel npm pack operations
- Fingerprint-based caching avoids redundant package builds across test runs
- Sequential test execution prevents npm package conflicts

**Error Resilience**:
- All cleanup operations are error-tolerant to prevent cascade failures
- Multiple cleanup layers (afterEach, afterAll) ensure no leaked resources
- Defensive error handling with graceful degradation

**Real-world Simulation**:
- Tests actual npm package distribution mechanism rather than mocks
- Uses global installation to simulate authentic npx usage scenarios
- Validates against real JavaScript/Python example files with actual debugging workflows

**Instrumentation and Observability**:
- Comprehensive logging of MCP tool calls with request/response capture
- Package size metrics and content verification
- Bidirectional transport message logging for debugging test issues

### Integration with Larger System

This test suite serves as the final validation layer for the MCP debugger's npm distribution pipeline, ensuring that:
- The npm package correctly includes all required language adapters (critical fix validation)
- The npx execution pathway functions properly in production-like environments
- End-to-end debugging workflows operate correctly across supported languages
- Package distribution mechanics (build, pack, install, execute) work reliably

The module acts as a bridge between the core MCP debugger functionality and real-world npm distribution, providing confidence that users can successfully install and use the debugger via standard npm/npx commands.