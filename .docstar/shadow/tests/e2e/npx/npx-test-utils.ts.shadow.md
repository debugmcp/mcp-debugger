# tests/e2e/npx/npx-test-utils.ts
@source-hash: f6267692df346a86
@generated: 2026-02-10T21:25:42Z

## NPX Test Utilities for MCP Debugger

Test utilities module for end-to-end testing of the MCP (Model Context Protocol) debugger through npm packaging and distribution. Manages workspace building, package creation, caching, and client connections for automated testing.

### Core Architecture

The module implements a sophisticated build and packaging pipeline with file-based locking, content fingerprinting, and caching to optimize test execution:

- **Lock-based coordination**: Prevents concurrent packaging operations via file-based locking mechanism
- **Content fingerprinting**: Uses SHA-256 hashing of package.json and dist directory to enable intelligent caching
- **Global installation testing**: Installs and tests packages via npm global installation rather than npx direct execution

### Key Components

#### Path Configuration (L19-31)
Critical path constants defining workspace structure:
- `ROOT`: Repository root directory
- `PACKAGE_DIR`: mcp-debugger package location
- `PACK_CACHE_DIR`: Cached tarball storage
- `ROOT_BUNDLE_ENTRY` & `PACKAGE_DIST_ENTRY`: Built artifact locations

#### Locking System (L33-75)
- `acquirePackLock()` (L33-64): File-based mutex with stale lock detection (5min timeout)
- `releasePackLock()` (L66-75): Lock cleanup with error tolerance

#### Build Pipeline (L86-99)
- `ensureWorkspaceBuilt()` (L86-99): Conditional building of root bundle and package dist
- Uses pnpm workspace commands for selective rebuilding

#### Content Fingerprinting (L108-139)
- `hashDirectoryContents()` (L108-132): Recursive directory hashing for cache keys
- `computePackFingerprint()` (L134-139): Combines package.json and dist directory hash

### Main Export Functions

#### `buildAndPackNpmPackage()` (L159-220)
Primary function orchestrating the complete build-and-pack workflow:
1. Ensures clean state and workspace build
2. Computes content fingerprint for caching
3. Acquires exclusive lock for packaging
4. Runs npm pack with destination control
5. Renames output to fingerprint-based cache file
6. Handles cleanup and lock release

Returns path to created/cached tarball.

#### `installPackageGlobally()` (L225-247) 
Installs tarball globally with verification:
- Uninstalls existing version first
- Installs from local tarball path
- Verifies installation via `npm list`

#### `createNpxMcpClient()` (L276-385)
Creates MCP client connected to globally-installed package:
- Resolves global CLI entry point via `npm root -g`
- Uses direct Node.js execution (bypasses npx.cmd on Windows)
- Implements bidirectional message logging to raw log files
- Returns client, transport, and cleanup function

#### Package Analysis Functions
- `getPackageSize()` (L390-399): Returns tarball size metrics
- `verifyPackageContents()` (L404-442): Analyzes tarball contents for required adapters (JavaScript, Python, Mock)

### Dependencies & Integrations

- **MCP SDK**: `@modelcontextprotocol/sdk` for client/transport functionality
- **Build Scripts**: Integrates with `scripts/prepare-pack.js` for package.json manipulation
- **Workspace Tools**: Uses pnpm for monorepo build coordination
- **File System**: Extensive fs/promises usage for file operations

### Configuration Interface

`NpxTestConfig` (L150-154) supports:
- `packagePath`: Custom package location
- `useGlobal`: Global vs local installation mode  
- `logLevel`: Debug output control

### Testing Patterns

Designed for integration testing scenarios where:
1. Package is built and cached based on content fingerprint
2. Package is installed globally for realistic distribution testing  
3. MCP client connects via resolved global installation
4. All operations include comprehensive logging and cleanup