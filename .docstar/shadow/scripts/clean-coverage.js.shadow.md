# scripts/clean-coverage.js
@source-hash: 399afae1c324d7aa
@generated: 2026-02-10T00:42:00Z

## Purpose
Utility script that safely removes the `coverage` directory, handling permission issues that arise when Docker containers create files with root ownership. Designed for cross-platform operation with fallback strategies.

## Architecture & Flow
- **Path Resolution (L17-20)**: Establishes project root and coverage directory paths using ES module utilities
- **Main Function**: `cleanCoverage()` (L22-75) implements a cascade of removal strategies with progressive escalation
- **Entry Point (L77-80)**: Async wrapper with error handling and process exit

## Key Functions

### cleanCoverage() (L22-75)
Core removal logic with multi-tier approach:
1. **Existence Check (L23-26)**: Early return if directory doesn't exist
2. **Primary Removal (L28-36)**: Attempts Node.js `fs/promises.rm()` with recursive force
3. **Permission Analysis (L41-48)**: Checks file ownership to determine escalation strategy
4. **Platform-Specific Fallbacks**:
   - **Windows (L50-63)**: Uses Alpine Docker container to handle permission issues
   - **Unix-like (L65-73)**: Falls back to `sudo rm -rf`

### removeWithNode() (L28-32)
Nested helper using Node.js native file system APIs for standard removal.

## Dependencies
- **Node.js Built-ins**: `child_process.execSync`, `fs.existsSync/statSync`, `fs/promises.rm`, `path`, `url.fileURLToPath`
- **External Requirements**: Docker (Windows), sudo (Unix-like systems)

## Platform Handling
- **Windows**: Docker-based removal using Alpine container with workspace volume mount
- **Unix-like**: Direct sudo escalation for root-owned files
- **Cross-platform**: Consistent logging and error messaging

## Error Handling Patterns
- Progressive fallback strategy with specific error messages
- Platform-aware error recovery
- Graceful degradation with manual cleanup instructions
- Process exit codes for CI/automation integration

## Critical Behavior
- Only escalates permissions when files are actually root-owned (`uid === 0`)
- Uses `force: true` and `recursive: true` for comprehensive cleanup
- Provides specific manual cleanup instructions when automated methods fail