# tests/e2e/npx/
@generated: 2026-02-10T21:26:27Z

## NPX End-to-End Test Suite for MCP Debugger

**Overall Purpose**: Complete end-to-end testing infrastructure for validating the MCP (Model Context Protocol) debugger when distributed and consumed via npm package. This test suite ensures the debugger works correctly in production scenarios where users install and run it using `npx mcp-debugger`.

**Key Value Proposition**: Tests the critical last-mile distribution mechanism - the gap between development/build artifacts and actual user consumption. Validates that JavaScript adapter inclusion, package structure, and runtime dependencies work correctly in npm-distributed packages.

## Architecture Overview

The directory implements a three-layer testing architecture:

1. **Test Utilities Layer** (`npx-test-utils.ts`): Core infrastructure for package building, distribution, and client connection management
2. **Language-Specific Test Suites** (`npx-smoke-*.test.ts`): End-to-end validation for JavaScript and Python debugging workflows  
3. **Global Installation Simulation**: Tests against globally-installed npm packages rather than local development artifacts

## Key Components & Integration

### Core Infrastructure (`npx-test-utils.ts`)
**Public API**:
- `buildAndPackNpmPackage()`: Builds, packs, and caches npm tarballs with content fingerprinting
- `installPackageGlobally()`: Manages global npm installation for realistic distribution testing
- `createNpxMcpClient()`: Creates MCP SDK clients connected to globally-installed packages
- `getPackageSize()`, `verifyPackageContents()`: Package analysis utilities

**Key Features**:
- **Content-based caching**: SHA-256 fingerprinting of package.json + dist directory prevents redundant rebuilds
- **File-based locking**: Mutex system prevents concurrent packaging operations
- **Comprehensive logging**: Bidirectional message logging for debugging test failures
- **Clean state management**: Automatic cleanup of global installations and resources

### Test Execution Pattern

Both language test suites follow identical 8-step debugging workflows:

1. **Environment Setup**: Build → Pack → Global Install → MCP Client Connection
2. **Language Availability**: Validate target language in `list_supported_languages`
3. **Session Lifecycle**: Create → Configure → Execute → Cleanup debug sessions
4. **Breakpoint Management**: Set breakpoints and verify execution pausing
5. **Variable Inspection**: Pre/post-execution variable state validation
6. **Execution Control**: Step-over operations and program continuation
7. **State Verification**: Confirm expected program behavior (variable swaps, etc.)
8. **Resource Cleanup**: Session closure and global package removal

## Internal Organization & Data Flow

```
User Test Execution
    ↓
Language Test Suite (JS/Python)
    ↓ (uses)
NPX Test Utils
    ↓ (manages)
Build Pipeline → Package Cache → Global Installation → MCP Client
    ↓ (connects to)
Globally Installed MCP Debugger Package
    ↓ (executes)
Debug Workflows on Real Scripts
```

**State Management Flow**:
1. Content fingerprint computed from source changes
2. Cached tarball used if fingerprint matches, otherwise rebuild
3. Global installation provides realistic runtime environment
4. MCP client connects via resolved global package entry points
5. Debug sessions operate on actual JavaScript/Python example files

## Important Patterns & Conventions

### Defensive Programming
- **Multi-layer cleanup**: afterEach, afterAll, and explicit cleanup functions prevent resource leaks
- **Stale lock detection**: 5-minute timeout prevents deadlocks from crashed test runs
- **Error tolerance**: Cleanup operations continue despite individual failures

### Performance Optimization  
- **Content-based caching**: Avoids unnecessary rebuilds when source unchanged
- **Sequential test execution**: Prevents npm global installation conflicts
- **Stabilization delays**: Strategic timeouts allow debug state transitions

### Testing Philosophy
- **Real distribution testing**: Uses actual npm global installation rather than mocks
- **Complete workflow validation**: Tests full debugging cycles, not isolated operations
- **Critical fix validation**: Specifically validates JavaScript adapter inclusion (the original packaging bug)

## Entry Points & Usage

**Primary Entry Point**: Test suites are executed via vitest, typically in CI/CD pipelines or development validation:

```bash
# Run all NPX tests
vitest tests/e2e/npx/

# Run specific language tests  
vitest tests/e2e/npx/npx-smoke-javascript.test.ts
vitest tests/e2e/npx/npx-smoke-python.test.ts
```

**Configuration**: Tests use standard vitest configuration with extended timeouts (240s setup, 120s execution) to accommodate packaging and global installation delays.

**Dependencies**: Requires pnpm workspace environment, npm global installation capabilities, and example debugging scripts in `examples/` directory.