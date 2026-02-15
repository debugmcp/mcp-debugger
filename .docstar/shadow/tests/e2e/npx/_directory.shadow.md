# tests\e2e\npx/
@children-hash: fef60bb0a0ce9f6c
@generated: 2026-02-15T09:01:25Z

## NPX End-to-End Testing Module

**Overall Purpose**: This directory implements comprehensive end-to-end testing for the MCP (Model Context Protocol) debugger when distributed and installed via npm/npx. The module validates that the packaged debugger works correctly in real-world deployment scenarios, specifically ensuring critical components like language adapters are properly included in the npm package distribution.

**Key Components and Integration**:

### Test Suites
- **`npx-smoke-javascript.test.ts`**: Validates JavaScript debugging functionality via npx-installed package, including a critical test that verifies the JavaScript adapter is included (addressing a packaging issue)
- **`npx-smoke-python.test.ts`**: Validates Python debugging functionality through complete workflow testing including session management, breakpoints, variable inspection, and execution control

### Infrastructure Utilities (`npx-test-utils.ts`)
- **Build Pipeline**: Automated workspace building, package creation with intelligent caching based on content fingerprinting
- **Package Management**: Global npm installation and verification for realistic distribution testing
- **MCP Client Factory**: Creates properly configured MCP clients connected to globally-installed packages
- **Locking System**: File-based mutex preventing concurrent packaging operations

**Public API Surface**:

### Primary Entry Points
- `buildAndPackNpmPackage()`: Core function orchestrating build-pack-cache workflow
- `installPackageGlobally()`: Installs and verifies global npm package installation
- `createNpxMcpClient()`: Factory for MCP clients connected to global installations
- `cleanupGlobalInstall()`: Removes globally installed test packages

### Test Execution Pattern
1. **Setup Phase**: Build and globally install npm package
2. **Connection**: Create MCP client via resolved global installation
3. **Validation**: Run language support and debugging workflow tests
4. **Cleanup**: Close sessions and remove global installations

**Internal Organization and Data Flow**:

### Build and Caching Strategy
- Content-based fingerprinting (SHA-256) enables intelligent caching
- Lock-based coordination prevents race conditions during packaging
- Workspace-aware building ensures consistent artifact generation

### Testing Architecture
- Sequential test execution prevents npm package conflicts
- Defensive cleanup strategies with multiple fallback layers
- Comprehensive logging with request/response instrumentation
- Real script execution rather than mocked environments

### Debug Workflow Validation
Each language test follows an 8-step debugging sequence:
1. Session creation
2. Breakpoint setting
3. Debug execution start
4. Variable inspection (pre-step)
5. Code stepping
6. Variable validation (post-step)
7. Continue execution
8. Session cleanup

**Important Patterns and Conventions**:

### Testing Methodology
- **Global Installation Testing**: Uses actual npm global installation rather than local npx execution for realistic distribution validation
- **Content Fingerprinting**: SHA-256 hashing of package.json + dist directory enables efficient caching
- **File-based Locking**: Prevents concurrent packaging with stale lock detection (5min timeout)
- **Bidirectional Logging**: All MCP communications logged to raw files for debugging

### Error Handling
- Try-catch blocks in cleanup prevent cascade failures
- Multiple cleanup layers (afterEach, afterAll) ensure no resource leaks
- Graceful handling of missing debug sessions and failed installations

### Performance Optimizations
- Intelligent caching based on content fingerprints reduces redundant packaging
- Conditional workspace building only rebuilds when necessary
- Strategic timeout configurations (240s setup, 120s tests) accommodate build times

**System Integration Role**:
This module serves as the final validation layer for the MCP debugger's npm distribution pipeline, ensuring that the packaged product maintains full functionality across supported programming languages when installed through standard npm mechanisms.