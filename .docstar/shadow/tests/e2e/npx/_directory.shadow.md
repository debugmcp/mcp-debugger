# tests/e2e/npx/
@generated: 2026-02-09T18:16:11Z

## NPX End-to-End Testing Module

Comprehensive test suite validating the MCP debugger's functionality when distributed and executed via npm package management (npx). This module ensures the debugger works correctly in real-world npm distribution scenarios, serving as the final integration validation before release.

### Overall Purpose
Tests the complete npm package distribution pipeline for the MCP debugger:
- Verifies language adapters (JavaScript, Python) are properly included in packaged distributions
- Validates full debugging workflows through npx execution
- Ensures npm packaging doesn't break debugger functionality
- Provides regression testing for packaging-related issues

### Key Components & Integration

**Test Infrastructure (`npx-test-utils.ts`)**
Core orchestration layer providing:
- Package building and npm pack operations with file-based locking
- Content fingerprinting and intelligent caching system
- Global npm installation management
- MCP client creation with npx-installed packages
- Package validation and size analysis utilities

**Language-Specific Test Suites**
- **`npx-smoke-javascript.test.ts`**: JavaScript debugging validation with complete workflow testing
- **`npx-smoke-python.test.ts`**: Python debugging validation with comprehensive DAP integration

Both test suites follow identical patterns:
1. Build and globally install npm package via tarball
2. Create MCP client connected to npx-installed server
3. Validate language adapter availability
4. Execute full debugging cycle (session → breakpoint → step → variables → cleanup)

### Public API Surface

**Main Entry Points:**
- `buildAndPackNpmPackage()`: Builds, packs, and caches npm package with fingerprint-based optimization
- `installPackageGlobally(tarballPath)`: Installs package globally for npx testing
- `createNpxMcpClient(config)`: Creates MCP client using npx-installed package
- `cleanupGlobalInstall()`: Removes global package installation

**Test Execution:**
- Sequential test suites preventing race conditions on global package state
- Extended timeouts (240s setup, 120s debugging) for npm operations
- Comprehensive error handling and cleanup in setup/teardown phases

### Internal Organization & Data Flow

**Build Pipeline:**
1. **Workspace Validation**: Ensures root and package distributions are built
2. **Lock Acquisition**: File-based mutex prevents concurrent npm pack operations
3. **Cache Check**: Content fingerprinting avoids unnecessary rebuilds
4. **Package Preparation**: Runs prepare-pack.js script for package.json manipulation
5. **NPM Pack**: Creates distributable tarball with atomic caching

**Test Execution Flow:**
1. **Global Setup**: Build → Pack → Install → MCP Client Creation
2. **Language Validation**: Verify adapter inclusion in distribution
3. **Debug Workflow**: Session → Breakpoint → Execute → Step → Variables → Cleanup
4. **Global Teardown**: Session cleanup → MCP disconnection → Package uninstall

**Caching & Performance:**
- SHA256 fingerprinting of package.json + dist directory contents
- Atomic cache operations prevent corruption
- Stale lock detection (5-minute timeout) prevents deadlocks

### Important Patterns & Conventions

**Sequential Execution**: All tests use `describe.sequential` to prevent interference with shared global package installation state

**Defensive Cleanup**: Multi-layer cleanup with error resilience:
- Per-test session cleanup (afterEach)
- Global cleanup (afterAll) 
- Try-catch wrapped operations to handle already-closed resources

**Comprehensive Logging**: 
- MCP message interception and logging to npx-raw.log
- Request/response wrapping for debugging test failures
- Package size and content validation logging

**State Validation**: Each debugging operation validates both success status and expected state changes, using deliberate wait periods for debug state stabilization

This module serves as the critical final validation ensuring the MCP debugger maintains full functionality when distributed through standard npm channels, preventing regressions in the packaging and distribution pipeline.