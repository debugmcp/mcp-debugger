# scripts/cleanup-test-processes.js
@source-hash: 88a41c937c802e52
@generated: 2026-02-09T18:15:15Z

## Purpose
Cross-platform test process cleanup script that identifies and terminates orphaned MCP-related processes after test suite execution. Specifically addresses proxy-bootstrap process orphaning issues on Unix systems.

## Key Functions

### executeCommand(cmd, silent = false) (L34-44)
Wrapper for execSync that handles command execution errors gracefully. Returns command output on success, null on failure. Silent mode suppresses error logging.

### getProcessList() (L46-56)
Platform-specific process enumeration:
- Windows: Uses `wmic process get ProcessId,ParentProcessId,CommandLine /format:csv`
- Unix: Uses `ps aux`
Returns raw process list string.

### findMcpProcesses() (L58-103)
Parses process list to identify MCP-related processes using patterns (L64-69):
- `${projectRoot}.*proxy-bootstrap` - Project-specific proxy processes
- `${projectRoot}.*dap-proxy` - Debug adapter proxy processes
- `vitest.*${projectRoot}` - Vitest test runners
- `debugpy.*${projectRoot}` - Python debugger processes

Extracts PIDs using platform-specific parsing (Windows CSV vs Unix space-delimited).

### killProcess(pid) (L105-129)
Platform-specific process termination:
- Windows: `taskkill /F /PID`
- Unix: Graceful SIGTERM followed by SIGKILL after 100ms delay

### cleanup() (L132-175)
Main cleanup orchestrator. Skips on Windows (L134-137). Finds orphaned processes, reports findings, and terminates them. Shows memory status on Linux systems.

## Architecture & Flow

**Platform Detection** (L18-21): Sets boolean flags for Windows, Darwin, and Linux.

**Project Context** (L22-26): Derives project root from script location, used for process pattern matching.

**Execution Logic** (L177-186): Runs cleanup only when not in CI environment and not on Windows platform.

## Dependencies
- `child_process.execSync` - Command execution
- `os` - Platform detection
- `path` - File system operations
- `url.fileURLToPath` - ES module path resolution

## Critical Constraints
- Only runs on non-Windows platforms outside CI environments
- Process matching is project-root specific to avoid killing unrelated processes
- Implements graceful termination with fallback to force-kill