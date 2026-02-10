# scripts/cleanup-test-processes.js
@source-hash: 88a41c937c802e52
@generated: 2026-02-10T00:42:03Z

## Purpose
Cross-platform utility script that cleans up orphaned test processes after test suite execution. Specifically designed to address issues with proxy-bootstrap and related MCP debugger processes becoming orphaned on Unix systems during test runs.

## Key Functions

**executeCommand(cmd, silent = false)** (L34-44)
- Wraps execSync with error handling and optional silent mode
- Returns command output or null on failure
- Used for all system command execution throughout the script

**getProcessList()** (L46-56) 
- Platform-specific process listing
- Windows: Uses WMIC with CSV format output
- Unix: Uses ps aux command
- Returns raw process list as string

**findMcpProcesses()** (L58-103)
- Core process discovery logic
- Searches for MCP-related processes using project-specific patterns (L64-69):
  - `${projectRoot}.*proxy-bootstrap`
  - `${projectRoot}.*dap-proxy` 
  - `vitest.*${projectRoot}`
  - `debugpy.*${projectRoot}`
- Parses PIDs from platform-specific output formats
- Returns array of {pid, command} objects

**killProcess(pid)** (L105-129)
- Platform-specific process termination
- Windows: Uses taskkill /F /PID
- Unix: Graceful SIGTERM followed by SIGKILL after 100ms delay
- Returns success boolean

**cleanup()** (L132-175)
- Main orchestration function
- Skips entirely on Windows (L134-137)
- Discovers, reports, and terminates orphaned processes
- Shows memory status on Linux systems

## Architecture & Flow

1. **Platform Detection** (L18-20): Sets boolean flags for OS-specific behavior
2. **Project Context** (L22-26): Derives project root and name from script location
3. **Conditional Execution** (L177-186): Runs only on non-Windows, non-CI environments
4. **Process Matching Strategy**: Uses project root path matching to avoid killing unrelated processes

## Key Dependencies
- `child_process.execSync`: System command execution
- `os`, `path`: Platform and filesystem utilities
- `url.fileURLToPath`: ES module path resolution

## Critical Constraints
- **Windows Exclusion**: Completely skips Windows due to different process model
- **CI Exclusion**: Skips in CI environments (assumes CI handles cleanup)
- **Project-Scoped**: Only targets processes containing the specific project root path
- **Graceful Degradation**: Continues on individual process kill failures

## Notable Patterns
- Cross-platform command execution with fallback handling
- Project-scoped process matching to prevent accidental kills
- Graceful Unix process termination (SIGTERM → SIGKILL)
- Environment-aware execution (CI detection, platform detection)