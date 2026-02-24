# packages\adapter-go\src\utils\go-utils.ts
@source-hash: e60211af072a9900
@generated: 2026-02-24T01:54:14Z

## Purpose
Cross-platform utility for discovering and validating Go and Delve debugger executables on the local system.

## Key Functions

**findGoExecutable(preferredPath?, logger?) → Promise<string>** (L19-57)
- Main Go executable discovery function with fallback strategy
- Priority: preferred path → PATH search → common install locations
- Platform-aware (go.exe vs go) with comprehensive error handling

**findDelveExecutable(preferredPath?, logger?) → Promise<string>** (L62-102)  
- Delve debugger discovery with multiple candidate names (dlv, dlv-dap)
- Searches PATH, then GOPATH/bin, with platform-specific executable names
- Provides installation instructions in error messages

**getGoVersion(goPath) → Promise<string | null>** (L107-127)
- Executes `go version` command and parses semantic version string
- Regex extraction from "go version go1.21.0 darwin/arm64" format
- Returns null on any failure, never throws

**getDelveVersion(dlvPath) → Promise<string | null>** (L132-152)
- Executes `dlv version` and parses "Version: X.Y.Z" format
- Similar error handling pattern to getGoVersion

**checkDelveDapSupport(dlvPath) → Promise<{supported: boolean; stderr?: string}>** (L158-176)
- Tests DAP (Debug Adapter Protocol) support via `dlv dap --help`
- Returns structured result with diagnostics for troubleshooting

**getGoSearchPaths() → string[]** (L181-214)
- Platform-specific search path generation for Go installations
- Handles Windows (C:\Go), macOS (Homebrew paths), and Linux standard locations
- Respects GOBIN environment variable with priority placement

## Internal Helpers

**getGopathBin() → Promise<string | null>** (L219-237)
- Resolves Go binary directory: GOBIN → GOPATH/bin → ~/go/bin fallback

**findInPath(name) → Promise<string | null>** (L242-255) 
- PATH environment variable search with platform-specific separators

**fileExists(filePath) → Promise<boolean>** (L260-267)
- Async file existence check with executable permission validation

## Architecture Notes
- Pure utility module with no external dependencies beyond Node.js built-ins
- Consistent async/await pattern with Promise-based APIs
- Platform abstraction for Windows/Unix differences in executable names and paths
- Graceful degradation: always returns null/false rather than throwing on discovery failures
- Optional logger interface (L10-14) for debugging without hard dependencies