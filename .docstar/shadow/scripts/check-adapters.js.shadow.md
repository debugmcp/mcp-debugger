# scripts/check-adapters.js
@source-hash: 9cf44abe560242b4
@generated: 2026-02-10T00:42:04Z

## Purpose
CLI utility for checking the vendoring status of debug adapters in a development environment. Provides unified status reporting for JavaScript (js-debug) and Rust (CodeLLDB) debug adapters across multiple platforms.

## Key Configuration
**Adapter Definitions (L17-32)**: Static configuration array defining two debug adapters:
- JavaScript adapter: Uses js-debug with specific vendor files and sidecars
- Rust adapter: Uses CodeLLDB with multi-platform binary support

## Core Functions

**getCurrentPlatform() (L37-48)**: Maps Node.js process.platform/arch to standardized platform identifiers (win32-x64, darwin-x64, darwin-arm64, linux-x64, linux-arm64).

**exists(filePath) (L53-60)**: Safe file/directory existence checker using fs.accessSync with error handling.

**readJsonSafe(filePath) (L65-71)**: JSON file reader with error handling, returns null on failure.

**checkJavaScriptAdapter(adapter) (L76-116)**: 
- Validates main vendor file existence
- Reads version from manifest.json
- Checks required sidecar files (bootloader.js, hash.js)
- Returns status object with vendoring state, version info, and issues

**checkRustAdapter(adapter) (L121-166)**:
- Validates platform-specific binaries across 5 supported platforms
- Checks for codelldb/codelldb.exe executables per platform
- Identifies current platform compatibility
- Returns multi-platform status with per-platform vendoring state

**formatStatus(status) (L171-218)**: Console formatter with ANSI colors, displays vendoring status, versions, platform info, sidecars, and issues.

**main() (L223-269)**: Entry point that:
- Iterates through adapter configurations
- Dispatches to appropriate checker based on adapter name
- Aggregates results and displays summary
- Exits with error code if adapters missing (unless in CI)

## Architecture Patterns
- **Configuration-driven**: Adapter definitions centralize file paths and requirements
- **Platform abstraction**: Standardized platform identifiers for cross-platform binary management
- **Error resilience**: All file operations use safe wrappers
- **Separation of concerns**: Distinct checkers for different adapter types
- **CLI-friendly**: ANSI color coding and structured output formatting

## Dependencies
- Node.js built-ins: fs, path, url
- ES modules with import.meta.url for __dirname equivalent

## Critical Constraints
- Expects specific directory structure: packages/adapter-{language}/vendor/
- Platform detection limited to 5 predefined combinations
- CI environment detection via process.env.CI affects exit behavior
- Direct invocation detection via process.argv[1] comparison