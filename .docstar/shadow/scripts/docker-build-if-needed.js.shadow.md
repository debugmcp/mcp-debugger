# scripts/docker-build-if-needed.js
@source-hash: 0e57bf943f16f8db
@generated: 2026-02-10T00:42:02Z

## scripts/docker-build-if-needed.js

**Primary Purpose**: Intelligent Docker image builder that conditionally builds Docker images only when needed, with robust handling of NPM package operations and comprehensive file change detection.

### Key Configuration (L8-12)
- `IMAGE_NAME`: Docker image name from env or 'mcp-debugger:local' default
- `FORCE_REBUILD`: Environment flag to force rebuilds
- `PACK_LOCK_PATH`: Lock file path for NPM pack operations
- `PACKAGE_BACKUP_PATH`: Backup location for package.json during pack operations
- `PACK_LOCK_MAX_WAIT_MS`: 5-minute timeout for pack lock waiting

### Core Functions

**waitForPackLockIfNeeded() (L16-31)**
- Monitors and waits for NPM pack operations to complete
- Implements timeout mechanism with 1-second polling intervals
- Prevents Docker build conflicts during package operations

**restorePackageManifestIfNeeded() (L33-42)**
- Recovers from interrupted NPM pack operations
- Calls external `scripts/prepare-pack.js restore` script
- Handles restoration failures gracefully with warnings

**getLatestModifiedTime() (L44-61)**
- Recursive directory traversal for modification time detection
- Excludes hidden directories and node_modules
- Returns newest modification time across all files in directory tree

**main() (L63-180)**
- Orchestrates entire build decision process
- Docker availability verification (docker + buildx)
- Image freshness comparison using timestamps
- Conditional build execution with proper cleanup

### Build Decision Logic (L136-148)
1. Force rebuild if `FORCE_REBUILD` is true
2. Build if image doesn't exist
3. Build if image is older than newest source file
4. Skip if image is current

### File Change Detection (L96-134)
Monitors critical files:
- Docker configuration: `Dockerfile`
- Dependencies: `package.json`, `package-lock.json`
- Build config: `tsconfig.json`, `vitest.workspace.ts`
- Scripts: `scripts/bundle.js`
- Shared packages: `packages/shared/package.json`

Scans directories recursively:
- `src/` - source code
- `scripts/` - build scripts  
- `packages/` - package modules

### Build Process (L149-179)
1. Remove existing image if present
2. Execute docker build with cache-busting timestamp
3. Enable BuildKit for enhanced performance
4. Verify successful image creation post-build
5. Exit with error code on any build failure

### Environment Integration
- Respects `SKIP_DOCKER_TESTS` to bypass entirely
- Uses `DOCKER_BUILDKIT=1` for optimized builds
- Supports configurable image naming via environment

### Error Handling Strategy
- Graceful degradation when Docker unavailable
- Comprehensive try-catch blocks around critical operations
- Process exit codes for CI/CD integration
- Warning messages for non-fatal issues