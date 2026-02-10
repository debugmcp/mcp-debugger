# src/cli/version.ts
@source-hash: d455d46bffa7d83a
@generated: 2026-02-10T00:41:44Z

## Version Resolution Module

**Primary Purpose**: Dynamically resolves the application version from package.json files across different module environments (CommonJS/ESM).

### Key Functions

**`getModuleDirectory()` (L7-22)**: Cross-environment directory resolver
- Handles CommonJS (`__dirname`) and ESM (`import.meta.url`) environments
- Falls back to `process.cwd()` if neither environment detection succeeds
- Uses try-catch to gracefully handle undefined `__dirname` in ESM contexts

**`getVersion()` (L24-47)**: Primary version extraction function
- Searches multiple package.json locations in priority order:
  - `../../package.json` (typical for nested src structure)
  - `../package.json` (fallback location)  
  - `./package.json` (current working directory)
- Validates version string exists and is non-empty before returning
- Implements silent error handling when `CONSOLE_OUTPUT_SILENCED=1` environment variable is set
- Returns `FALLBACK_VERSION` ('0.0.0') if all package.json reads fail

### Dependencies
- Node.js built-ins: `fs`, `path`, `url.fileURLToPath`
- Runtime environment detection via `__dirname`/`import.meta.url`

### Architectural Patterns
- **Graceful degradation**: Multiple fallback strategies for both directory resolution and version lookup
- **Environment agnostic**: Works in both CommonJS and ESM module systems
- **Silent failure mode**: Respects environment variable for suppressing error output

### Critical Constraints
- Requires readable package.json with valid JSON structure
- Version field must be non-empty string
- File system access permissions needed for package.json locations