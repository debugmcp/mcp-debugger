# tests\e2e\npx/
@generated: 2026-02-12T21:05:47Z

## NPX End-to-End Testing Module

**Purpose**: Comprehensive end-to-end testing infrastructure for validating the MCP (Model Context Protocol) debugger when distributed and executed via npm package installation. This module ensures that critical debugging functionality works correctly after packaging and global installation, specifically validating that required language adapters (JavaScript, Python) are properly included in the distributed package.

## Architecture Overview

The module implements a complete testing pipeline from source code to packaged distribution:

1. **Build & Package Pipeline**: Automated workspace building, npm packaging with intelligent caching
2. **Global Installation Testing**: Installs packages globally via npm to simulate real-world usage
3. **MCP Client Integration**: Creates authenticated MCP connections to globally installed packages
4. **Language-Specific Validation**: Tests complete debugging workflows for supported programming languages

## Key Components

### Test Utilities (`npx-test-utils.ts`)
Core infrastructure providing:
- **Build coordination**: Lock-based packaging with content fingerprinting and caching
- **Package management**: Global npm installation/uninstallation with verification
- **Client creation**: MCP client connections to globally installed packages with bidirectional logging
- **Package analysis**: Size metrics and content verification (adapter inclusion validation)

**Public API**:
- `buildAndPackNpmPackage()`: Main orchestrator for build-pack-cache workflow
- `installPackageGlobally()` / `cleanupGlobalInstall()`: Global package lifecycle management
- `createNpxMcpClient()`: Authenticated MCP client factory for installed packages
- `getPackageSize()` / `verifyPackageContents()`: Package analysis utilities

### Language-Specific Test Suites

**JavaScript Testing** (`npx-smoke-javascript.test.ts`):
- **Critical validation**: Ensures JavaScript adapter inclusion (addresses known packaging issue)
- **Complete workflow**: Session creation, breakpoints, variable inspection, execution control
- **Test script**: `examples/javascript/simple_test.js` execution validation

**Python Testing** (`npx-smoke-python.test.ts`):
- **8-step debugging sequence**: Full Python debugging lifecycle validation
- **Variable state tracking**: Pre/post-execution variable inspection (swap operation validation)
- **Test script**: `examples/python/simple_test.py` execution with breakpoint management

## Data Flow & Integration

```
Source Code → Build Pipeline → Package Creation → Global Installation → MCP Client → Debugging Workflow
```

1. **Preparation**: `buildAndPackNpmPackage()` creates cached, fingerprinted tarballs
2. **Installation**: `installPackageGlobally()` installs package for testing
3. **Connection**: `createNpxMcpClient()` establishes MCP connection to installed package
4. **Validation**: Language-specific tests execute complete debugging workflows
5. **Cleanup**: Global package removal and resource cleanup

## Testing Patterns & Conventions

- **Sequential execution**: Prevents npm package installation conflicts
- **Comprehensive cleanup**: Multi-layered resource cleanup (afterEach, afterAll)
- **Content-based caching**: Avoids unnecessary rebuilds via SHA-256 fingerprinting
- **Defensive error handling**: Cleanup operations include try-catch for cascade failure prevention
- **Realistic distribution testing**: Uses actual npm global installation rather than development shortcuts

## Critical Dependencies

- **MCP SDK**: `@modelcontextprotocol/sdk/client` for debugger communication
- **Build System**: pnpm workspace integration for monorepo coordination
- **Test Framework**: Vitest with extended timeouts for packaging operations
- **Package Management**: npm CLI for global installation/verification
- **File System**: Extensive async file operations for caching and analysis

## Entry Points

- **`npx-test-utils.ts`**: Primary infrastructure module - import for custom test scenarios
- **`npx-smoke-*.test.ts`**: Ready-to-run test suites - execute via test runner
- **Configuration**: `NpxTestConfig` interface for customizing test behavior

This module serves as the definitive validation layer ensuring that the MCP debugger package distribution includes all necessary components and functions correctly in real-world npm installation scenarios.