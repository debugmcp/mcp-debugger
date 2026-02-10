# packages/adapter-rust/src/utils/codelldb-resolver.ts
@source-hash: 3f62785e4fa6cab0
@generated: 2026-02-09T18:14:08Z

## CodeLLDB Executable Resolver

**Purpose**: Locates and validates CodeLLDB debugger executable across different platforms and deployment scenarios for Rust debugging support.

### Core Functions

**`resolveCodeLLDBExecutable()` (L15-63)**
- Primary executable resolution with platform-aware path mapping
- Maps `process.platform` and `process.arch` to platform directories (L21-29):
  - Windows: `win32-x64`
  - macOS: `darwin-arm64` or `darwin-x64`
  - Linux: `linux-arm64` or `linux-x64`
- Searches multiple candidate paths in priority order (L33-41):
  1. Package root production install
  2. Backward compatibility location under `dist/`
  3. Monorepo source tree fallbacks
  4. Current working directory relative paths
- Fallback to `CODELLDB_PATH` environment variable (L53-60)
- Returns first accessible path or `null` if none found

**`getCodeLLDBVersion()` (L68-106)**
- Retrieves version information from accompanying `version.json` files
- Uses same platform directory resolution logic as executable resolver
- Searches corresponding version file candidates (L88-93)
- Returns parsed version from JSON or defaults to `'1.11.0'`
- Depends on `resolveCodeLLDBExecutable()` for initial validation

### Key Dependencies
- `fs/promises`: Asynchronous file system operations for access checks and file reading
- `path`: Cross-platform path manipulation
- `url.fileURLToPath()`: ES module compatibility for `__dirname` equivalent

### Architecture Patterns
- **Multi-path resolution strategy**: Handles various deployment scenarios (production, development, monorepo)
- **Platform abstraction**: Centralizes platform-specific executable naming and directory structure
- **Graceful degradation**: Continues searching through candidates on access failures
- **Environment variable override**: Provides escape hatch for custom installations

### Critical Constraints
- Assumes vendored CodeLLDB follows specific directory structure: `vendor/codelldb/{platform}/adapter/`
- Windows executable must have `.exe` extension (L32)
- Version file format must contain `version` property in JSON structure
- All file system operations are asynchronous and may fail silently