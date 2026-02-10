# packages/adapter-go/src/utils/go-utils.ts
@source-hash: 09eab457691198b9
@generated: 2026-02-09T18:13:54Z

## Purpose
Core utility module for discovering and managing Go/Delve executables in the VS Code Go adapter. Provides cross-platform executable location, version checking, and capability detection for Go toolchain integration.

## Key Functions

### Executable Discovery
- **`findGoExecutable()`** (L19-57): Locates Go executable using preferred path, PATH lookup, then common installation directories. Throws if not found with installation guidance.
- **`findDelveExecutable()`** (L62-102): Similar pattern for Delve debugger, additionally checks GOPATH/bin. Returns installation command on failure.
- **`getGoSearchPaths()`** (L174-207): Platform-specific search paths including system locations, user directories, and environment variables (GOBIN).

### Version & Capability Detection  
- **`getGoVersion()`** (L107-127): Spawns `go version` and parses semantic version from output using regex `/go(\d+\.\d+(\.\d+)?)/`.
- **`getDelveVersion()`** (L132-152): Spawns `dlv version` and extracts version from "Version: X.Y.Z" format.
- **`checkDelveDapSupport()`** (L157-169): Tests DAP support by running `dlv dap --help` and checking exit code.

### Helper Functions
- **`getGopathBin()`** (L212-230): Resolves Go binary directory from GOBIN → GOPATH/bin → ~/go/bin fallback chain.
- **`findInPath()`** (L235-248): Cross-platform PATH environment variable parsing and executable search.
- **`fileExists()`** (L253-260): Async file existence check with execute permission validation.

## Architecture Patterns
- **Promise-based async pattern**: All I/O operations return promises for non-blocking execution
- **Graceful degradation**: Functions return null/false on failure rather than throwing (except main discovery functions)
- **Platform abstraction**: Windows (.exe) vs Unix executable handling throughout
- **Environment-aware**: Respects GOBIN, GOPATH, PATH, HOME/USERPROFILE environment variables
- **Logging integration**: Optional logger interface for debug tracing

## Dependencies
- **child_process.spawn**: For executing Go/Delve commands
- **path**: Cross-platform path manipulation  
- **fs.promises**: Async file system operations

## Key Invariants
- Executable discovery follows precedence: preferred path → PATH → common locations → environment-based paths
- All version parsing is fault-tolerant with null returns on parse failure
- Cross-platform compatibility maintained through platform detection and appropriate executable naming