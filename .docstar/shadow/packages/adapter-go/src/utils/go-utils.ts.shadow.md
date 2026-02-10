# packages/adapter-go/src/utils/go-utils.ts
@source-hash: 09eab457691198b9
@generated: 2026-02-10T00:41:11Z

## Primary Purpose
Utility module for discovering and validating Go and Delve debugger executables across different platforms. Provides comprehensive executable location strategies and version checking functionality for the Go adapter.

## Key Functions

### Executable Discovery
- `findGoExecutable(preferredPath?, logger?)` (L19-57): Locates Go executable using multi-tiered search strategy: preferred path → PATH lookup → common installation directories. Throws error if not found.
- `findDelveExecutable(preferredPath?, logger?)` (L62-102): Similar to Go discovery but includes GOPATH/bin search and supports multiple Delve variants (dlv, dlv-dap).
- `findInPath(name)` (L235-248): Internal helper that searches PATH environment variable for executable by name.

### Version Checking
- `getGoVersion(goPath)` (L107-127): Spawns `go version` command and extracts semantic version using regex pattern `/go(\d+\.\d+(\.\d+)?)/`.
- `getDelveVersion(dlvPath)` (L132-152): Spawns `dlv version` and parses output for version string using pattern `/Version:\s*(\d+\.\d+\.\d+)/`.
- `checkDelveDapSupport(dlvPath)` (L157-169): Tests DAP protocol support by running `dlv dap --help`.

### Path Resolution
- `getGoSearchPaths()` (L174-207): Returns platform-specific common installation paths. Includes GOBIN environment variable priority and filters empty paths.
- `getGopathBin()` (L212-230): Resolves Go binary directory from GOBIN → GOPATH/bin → default ~/go/bin hierarchy.
- `fileExists(filePath)` (L253-260): Async file existence check with executable permission validation using `fs.constants.X_OK`.

## Platform Handling
Cross-platform executable discovery with Windows (.exe suffix) vs Unix platform differentiation. Search paths include:
- Windows: C:\Go\bin, Program Files, USERPROFILE, LOCALAPPDATA
- macOS: Homebrew paths, /usr/local/go/bin
- Linux: Standard /usr paths, ~/.local/bin

## Dependencies
- `child_process.spawn` for command execution
- Node.js `fs.promises` for file system operations
- Node.js `path` for cross-platform path manipulation

## Error Handling
Functions use graceful error handling with null returns for version checks and meaningful error messages for required executables. All spawn operations include error event handlers to prevent unhandled exceptions.

## Architectural Patterns
- Optional logger interface with safe navigation (L10-14)
- Promise-based async API throughout
- Platform-agnostic executable naming
- Environment variable precedence system