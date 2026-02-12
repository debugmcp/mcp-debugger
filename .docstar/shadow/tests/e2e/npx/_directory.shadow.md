# tests\e2e\npx/
@generated: 2026-02-12T21:01:01Z

## NPX E2E Test Suite

**Overall Purpose**: End-to-end test suite validating the MCP debugger's functionality when distributed and consumed via npm package installation (simulating real-world `npx` usage). Tests critical integration points between the packaged MCP server and debug adapters to ensure JavaScript and Python debugging capabilities work correctly in production deployment scenarios.

## Architecture & Components

### Core Test Infrastructure
- **`npx-test-utils.ts`**: Central test utilities module providing build pipeline, package management, and MCP client creation
- **`npx-smoke-javascript.test.ts`**: JavaScript debugging workflow validation
- **`npx-smoke-python.test.ts`**: Python debugging workflow validation

### Key Integration Points

**Build & Package Pipeline** (npx-test-utils):
- Content fingerprinting and caching system prevents redundant rebuilds
- File-based locking coordinates concurrent test execution
- Global npm installation simulates real package distribution
- Comprehensive package verification ensures required adapters are included

**Test Execution Flow**:
1. **Setup Phase**: Build workspace → Pack npm package → Install globally → Create MCP client
2. **Language Validation**: Verify target language appears in supported languages list
3. **Full Debug Cycle**: Session creation → Breakpoint setting → Code execution → Variable inspection → Session cleanup
4. **Teardown Phase**: Close sessions → Cleanup processes → Remove global packages

## Public API Surface

### Main Entry Points
- `buildAndPackNpmPackage()`: Complete build-to-package pipeline with caching
- `installPackageGlobally()`: Global npm package installation with verification
- `createNpxMcpClient()`: MCP client connected to globally-installed package
- `getPackageSize()` / `verifyPackageContents()`: Package analysis utilities

### Test Suites
- **JavaScript Smoke Tests**: Validates JavaScript adapter inclusion and complete debugging workflow
- **Python Smoke Tests**: Validates Python debugging functionality through npm package

## Internal Organization & Data Flow

### Caching & Optimization
- **Content Fingerprinting**: SHA-256 hashing of package.json + dist directory enables intelligent caching
- **Lock Coordination**: File-based mutex prevents concurrent packaging operations
- **Build Dependencies**: Integrates with pnpm workspace and package preparation scripts

### State Management
Each test suite maintains:
- **MCP Client**: SDK client instance with instrumented logging
- **Session ID**: Active debug session identifier
- **Cleanup Functions**: Hierarchical cleanup for processes, connections, and global packages

### Debug Workflow Validation
Consistent 8-step debugging sequence across languages:
1. Session creation with language specification
2. Breakpoint placement at strategic code location
3. Debug execution initiation
4. Pre-execution variable state inspection
5. Step-over operation to advance execution
6. Post-execution variable state verification
7. Continue execution to completion
8. Session cleanup and resource release

## Important Patterns & Conventions

### Test Isolation
- **Sequential Execution**: `describe.sequential()` prevents npm package conflicts
- **Global State Cleanup**: Multi-level cleanup (afterEach, afterAll) ensures no resource leaks
- **Defensive Error Handling**: Try-catch blocks in cleanup prevent cascade failures

### Real-World Simulation
- **Global Installation**: Tests actual npm global package installation rather than local linking
- **NPX Resolution**: Resolves global CLI entry point to simulate npx command resolution
- **Actual Script Execution**: Uses real JavaScript/Python example files rather than mocks

### Logging & Debugging
- **Comprehensive Instrumentation**: All MCP tool calls logged with request/response details
- **Bidirectional Message Logging**: Raw MCP protocol messages captured to log files
- **Performance Metrics**: Package size and build time tracking

## Critical Validations

The test suite addresses the core business requirement of ensuring debug adapters are properly included in npm package distribution, specifically validating that JavaScript debugging works after npm installation (fixing previous packaging issues where adapters were excluded).

**Success Criteria**:
- Language appears in supported languages list
- Debug sessions can be created for target languages
- Breakpoints can be set and hit during execution
- Variable inspection works at runtime
- Step-over operations advance execution correctly
- Sessions can be properly closed without resource leaks