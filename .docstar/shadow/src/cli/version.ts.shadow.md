# src/cli/version.ts
@source-hash: d455d46bffa7d83a
@generated: 2026-02-09T18:14:58Z

## Purpose
Version resolution utility for CLI applications that works across CommonJS and ESM environments. Dynamically locates and reads package.json files to extract version information with fallback handling.

## Key Functions

### `getModuleDirectory()` (L7-22)
Cross-platform module directory resolver that handles both CommonJS (`__dirname`) and ESM (`import.meta.url`) contexts. Falls back to `process.cwd()` if neither is available. Uses try-catch to handle environments where `__dirname` is undefined.

### `getVersion()` (L24-47) 
Main export function that searches for package.json files in multiple candidate locations:
- `../../package.json` (typical monorepo structure)
- `../package.json` (standard npm package structure)  
- `./package.json` (current working directory)

Returns the first valid version string found, or falls back to `FALLBACK_VERSION` ('0.0.0').

## Dependencies
- `fs`: File system operations for reading package.json
- `path`: Path manipulation utilities
- `url.fileURLToPath`: ESM URL to file path conversion

## Key Constants
- `FALLBACK_VERSION` (L5): Default version '0.0.0' when no valid package.json found

## Error Handling
- Silent failure with fallback for missing/invalid package.json files
- Conditional error logging based on `CONSOLE_OUTPUT_SILENCED` environment variable (L40-42)
- Validates version is non-empty string before returning

## Architectural Decisions
- Multi-path search strategy accommodates different project structures
- Environment-aware module resolution supports both build systems
- Graceful degradation ensures function always returns a valid version string