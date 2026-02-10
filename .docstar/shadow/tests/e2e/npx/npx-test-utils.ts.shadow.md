# tests/e2e/npx/npx-test-utils.ts
@source-hash: 6a31ebd1eba3ae67
@generated: 2026-02-10T00:41:31Z

## Purpose
Comprehensive testing utilities for validating MCP debugger distribution via npm/npx. Provides build orchestration, package caching, global installation management, and MCP client creation for end-to-end testing scenarios.

## Key Components

### Path Configuration (L19-32)
- `ROOT`: Repository root directory
- `PACKAGE_DIR`: mcp-debugger package location
- `PACK_CACHE_DIR`: Cached tarball storage
- `PACK_LOCK_PATH`: Lock file for concurrent build protection

### Build Coordination
- `acquirePackLock()` (L33-64): Process-safe lock acquisition with stale detection (5min timeout)
- `releasePackLock()` (L66-75): Lock cleanup with error tolerance
- `ensureWorkspaceBuilt()` (L86-99): Conditional builds for root and package dist
- `ensurePackageBackupRestored()` (L101-106): Restores package.json from backup state

### Package Caching System
- `computePackFingerprint()` (L134-139): SHA256 hash of package.json + dist directory
- `hashDirectoryContents()` (L108-132): Recursive directory hashing for cache invalidation
- `getCachedTarballPath()` (L145-148): Cache lookup by fingerprint

### Core Export Functions
- `buildAndPackNpmPackage()` (L159-220): Main orchestration - builds, packs, caches npm tarball with lock management
- `installPackageGlobally()` (L225-247): Global npm installation from tarball with verification
- `cleanupGlobalInstall()` (L252-261): Global package removal (error-tolerant)
- `createNpxMcpClient()` (L266-373): Creates MCP client via npx with transport logging
- `getPackageSize()` (L378-387): Tarball size metrics
- `verifyPackageContents()` (L392-430): Validates adapter presence in package

### Transport Integration
- Wraps StdioClientTransport with bidirectional message logging (L294-346)
- Configurable log levels and file outputs
- Random request ID offset to prevent conflicts (L323-324)

## Dependencies
- MCP SDK client components for transport and protocol
- Node.js fs/crypto/child_process for system operations
- External scripts: `scripts/prepare-pack.js` for package.json manipulation

## Critical Patterns
- **Lock-based concurrency**: Prevents parallel npm pack operations
- **Fingerprint-based caching**: Avoids redundant package builds
- **Graceful error handling**: All cleanup operations are error-tolerant
- **Backup/restore cycle**: Package.json modifications are reversible

## Configuration Interface
`NpxTestConfig` (L150-154): Optional packagePath, useGlobal flag, logLevel setting