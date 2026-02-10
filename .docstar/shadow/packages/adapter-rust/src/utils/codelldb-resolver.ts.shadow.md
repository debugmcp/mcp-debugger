# packages/adapter-rust/src/utils/codelldb-resolver.ts
@source-hash: d3ce87d62d99b002
@generated: 2026-02-10T01:19:01Z

**CodeLLDB Executable Resolver for Rust Debug Adapter**

This utility module resolves platform-specific CodeLLDB debugger executable paths and versions for the Rust debug adapter. CodeLLDB is a LLDB-based debugger frontend used for debugging Rust applications.

## Core Functions

**`resolveCodeLLDBExecutable()` (L15-63)**
- Asynchronously resolves the CodeLLDB executable path based on current platform and architecture
- Returns `Promise<string | null>` - executable path or null if not found
- Platform mapping logic (L21-29):
  - Windows: `win32-x64`
  - macOS: `darwin-arm64` (Apple Silicon) or `darwin-x64` (Intel)
  - Linux: `linux-arm64` or `linux-x64`
  - Unsupported platforms return null
- Search strategy with multiple fallback paths (L33-41):
  1. Package root production install (`../../vendor/codelldb/...`)
  2. Legacy dist directory (`../vendor/codelldb/...`) 
  3. Monorepo source tree paths
  4. Process CWD relative paths
- Environment variable fallback: `CODELLDB_PATH` (L53-60)

**`getCodeLLDBVersion()` (L68-109)**
- Retrieves CodeLLDB version information
- Returns `Promise<string | null>` - version string or null if unavailable
- First resolves executable path, then searches for `version.json` manifest
- Uses same platform detection logic as resolver (L79-89)
- Default fallback version: `'1.11.0'` (L108)

## Key Dependencies

- `fs/promises`: Async file system operations for path validation and file reading
- `path`: Cross-platform path manipulation
- `url`: ES module URL utilities for `__dirname` resolution (L9-10)

## Architecture Patterns

- **Multi-path resolution strategy**: Handles various deployment scenarios (production, development, monorepo)
- **Platform abstraction**: Encapsulates platform-specific executable naming and directory structure
- **Graceful degradation**: Multiple fallback mechanisms ensure robustness
- **Environment override**: Allows manual CodeLLDB path specification via env var

## Critical Constraints

- Requires vendored CodeLLDB binaries in specific directory structure
- Platform detection limited to Windows, macOS, and Linux
- Version detection depends on manifest files; falls back to hardcoded version
- All file system operations are async and use try-catch for error handling