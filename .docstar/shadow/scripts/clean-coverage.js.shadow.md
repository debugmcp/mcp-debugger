# scripts/clean-coverage.js
@source-hash: 399afae1c324d7aa
@generated: 2026-02-09T18:15:12Z

**Primary Purpose**: Node.js CLI script that safely removes the `coverage` directory, handling permission issues that arise when Docker containers create root-owned files.

**Core Architecture**:
- **Path Resolution (L17-20)**: Establishes project root and coverage directory paths using ES module URL resolution
- **Main Function**: `cleanCoverage()` (L22-75) - Orchestrates removal with fallback strategies

**Key Functions**:
- **removeWithNode()** (L28-32): Inner function using Node.js `fs.rm()` for standard removal
- **cleanCoverage()** (L22-75): Main logic with permission-aware removal strategies
- **Error Handler** (L77-80): Top-level catch for unexpected errors

**Removal Strategy Flow**:
1. **Existence Check** (L23-26): Early return if coverage directory doesn't exist
2. **Standard Removal** (L34-36): First attempt using Node.js native `fs.rm()`
3. **Permission Analysis** (L41-42): Check if directory is root-owned via `statSync()`
4. **Platform-Specific Fallbacks**:
   - **Windows** (L50-63): Docker helper container with Alpine Linux for root-owned cleanup
   - **Unix-like** (L65-73): `sudo rm -rf` for root-owned directories

**Key Dependencies**:
- `child_process.execSync`: System command execution for sudo/docker fallbacks
- `fs/fs.promises`: File system operations (existence check, removal, stats)
- `path/url`: ES module path resolution

**Architecture Patterns**:
- **Graceful Degradation**: Multiple fallback strategies for different failure scenarios
- **Platform Awareness**: Windows-specific Docker workaround vs Unix sudo approach
- **Error Context Preservation**: Maintains original error information through fallback chain

**Critical Constraints**:
- Requires Docker availability on Windows for root-owned file cleanup
- Requires sudo privileges on Unix systems for root-owned files
- Uses `force: true` to ignore missing files/directories during removal