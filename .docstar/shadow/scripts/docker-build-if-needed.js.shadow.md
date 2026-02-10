# scripts/docker-build-if-needed.js
@source-hash: 0e57bf943f16f8db
@generated: 2026-02-09T18:15:15Z

## Primary Purpose
Intelligent Docker image build script that conditionally builds the `mcp-debugger:local` image only when source files are newer than the existing image, optimizing CI/CD performance by avoiding unnecessary rebuilds.

## Key Configuration & Constants (L8-12)
- `IMAGE_NAME`: Docker image name from env or defaults to 'mcp-debugger:local'
- `FORCE_REBUILD`: Environment flag to force rebuild regardless of file timestamps
- `PACK_LOCK_PATH`: Lock file path for NPX packaging operations
- `PACKAGE_BACKUP_PATH`: Backup location for package.json during pack operations
- `PACK_LOCK_MAX_WAIT_MS`: 5-minute timeout for pack lock operations

## Core Functions

### `waitForPackLockIfNeeded()` (L16-31)
Waits for NPX packaging operations to complete by monitoring lock file existence. Implements timeout protection to prevent indefinite blocking.

### `restorePackageManifestIfNeeded()` (L33-42)  
Recovers from interrupted NPX pack operations by restoring package.json from backup using external script.

### `getLatestModifiedTime()` (L44-61)
Recursive filesystem walker that finds the most recent modification time across directory trees. Skips hidden directories and node_modules for performance.

### `main()` (L63-180)
Primary orchestration function implementing the build decision logic:
1. **Environment checks**: Validates Docker availability and respects skip flags
2. **Lock management**: Waits for packaging locks and restores manifests
3. **Image inspection**: Determines if current image exists and its build timestamp
4. **File monitoring**: Tracks modification times of critical files and source directories
5. **Build decision**: Compares image timestamp against newest file modifications
6. **Build execution**: Removes old image, builds new one with cache-busting, and verifies success

## File Tracking Strategy (L95-134)
Monitors specific configuration files (Dockerfile, package.json, tsconfig.json, etc.) and recursively scans source directories (src/, scripts/, packages/) to determine if rebuild is needed.

## Build Process Features
- **Cache busting**: Uses timestamp in build args to ensure fresh builds
- **BuildKit support**: Enables Docker BuildKit for improved performance  
- **Image verification**: Post-build inspection to confirm successful creation
- **Error handling**: Comprehensive error recovery with process exit codes
- **Logging**: Detailed console output with timestamps and build reasoning

## Dependencies
- Node.js child_process for Docker command execution
- File system operations for timestamp checking and lock file monitoring
- Path utilities for cross-platform file path handling

## Critical Behaviors
- Respects `SKIP_DOCKER_TESTS` environment variable to bypass all operations
- Implements defensive programming with try-catch blocks around Docker operations
- Uses inheritance of stdio for build output visibility
- Maintains atomic operations through lock file coordination