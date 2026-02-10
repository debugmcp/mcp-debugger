# tests/e2e/npx/npx-test-utils.ts
@source-hash: 6a31ebd1eba3ae67
@generated: 2026-02-09T18:14:42Z

## NPX Test Utilities for MCP Debugger

Test infrastructure for validating MCP debugger through npm package distribution (npx execution). Provides comprehensive build, packaging, installation, and testing utilities.

### Core Functionality

**Path Management & Constants (L19-31)**
- Defines project structure paths including ROOT, package directories, build outputs
- Key paths: PACKAGE_DIR, PACK_CACHE_DIR, ROOT_BUNDLE_ENTRY, PACKAGE_DIST_ENTRY
- Manages package.json backup/restore locations

**Package Lock System (L33-75)**
- `acquirePackLock()` (L33-64): Implements file-based mutex to prevent concurrent npm pack operations
- `releasePackLock()` (L66-75): Cleanup lock file with error handling
- Uses 5-minute stale lock detection (PACK_LOCK_STALE_MS)

**Build Management (L86-106)**
- `ensureWorkspaceBuilt()` (L86-99): Validates and rebuilds root/package distributions as needed
- `ensurePackageBackupRestored()` (L101-106): Restores package.json from backup before operations
- Checks for ROOT_BUNDLE_ENTRY and PACKAGE_DIST_ENTRY existence

**Caching System (L108-148)**
- `computePackFingerprint()` (L134-139): SHA256 hash of package.json + dist directory contents
- `hashDirectoryContents()` (L108-132): Recursive directory hashing for cache invalidation
- `getCachedTarballPath()` (L145-148): Cache lookup by fingerprint

### Public API

**Main Build Function (L159-220)**
- `buildAndPackNpmPackage()`: Core orchestrator function
  - Ensures workspace built, acquires lock, checks cache
  - Runs prepare-pack.js script, executes npm pack
  - Implements fingerprint-based caching with atomic operations
  - Returns path to created/cached tarball

**Global Installation Management (L225-261)**
- `installPackageGlobally(tarballPath)` (L225-247): Installs from tarball with verification
- `cleanupGlobalInstall()` (L252-261): Removes global package installation

**MCP Client Creation (L266-373)**
- `createNpxMcpClient(config)`: Creates MCP client using npx-installed package
- Configures StdioClientTransport with logging and message interception
- Returns client, transport, and cleanup function
- Implements bidirectional message logging to npx-raw.log

**Package Analysis (L378-430)**
- `getPackageSize(tarballPath)` (L378-387): Returns size in KB/MB
- `verifyPackageContents(tarballPath)` (L392-430): Validates adapter inclusion via tar listing

### Dependencies
- @modelcontextprotocol/sdk: Client and transport classes
- Node.js built-ins: fs, child_process, crypto, path
- External scripts: scripts/prepare-pack.js for package.json manipulation

### Architecture Notes
- Implements robust concurrent access control via file locking
- Uses content-based fingerprinting for intelligent caching
- Provides comprehensive logging and error handling
- Supports both direct tarball usage and global installation testing paths