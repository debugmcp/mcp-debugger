# scripts/check-bundle-size.js
@source-hash: 235d3ba0b8152e38
@generated: 2026-02-10T00:41:58Z

## Bundle Size Validation Script

**Purpose**: Build-time validation tool that monitors the size of the mcp-debugger CLI bundle to ensure it remains suitable for "batteries included" npm distribution. Specifically checks `cli.mjs` bundle size against predefined thresholds.

### Key Components

**Main Function**: `checkBundleSize()` (L19-94) - Core validation logic that:
- Validates presence of dist directory and cli.mjs bundle
- Measures file size in KB/MB (L36-38)
- Applies warning (8MB) and error (15MB) thresholds (L46-62)
- Analyzes bundle contents via optional metafile (L64-88)
- Provides actionable feedback for size violations

**Configuration**: 
- `WARN_SIZE_MB = 8` (L16) - Warning threshold for bundle size monitoring
- `ERROR_SIZE_MB = 15` (L17) - Hard limit that causes build failure
- Target bundle path: `packages/mcp-debugger/dist/cli.mjs` (L20-30)

**Bundle Analysis**: Enhanced reporting (L64-88) that:
- Parses optional `bundle-meta.json` to show included files
- Validates presence of critical adapters (JavaScript, Python, Mock)
- Warns if JavaScript adapter is missing (breaks npx distribution)

### Dependencies
- Node.js fs/path modules for file system operations
- ES modules with `import.meta.url` for path resolution (L11-13)

### Exit Behavior
- Exit 0: No dist directory or cli.mjs found (soft failures)
- Exit 1: Bundle exceeds error threshold or unexpected errors
- Graceful exit for acceptable sizes

### Critical Constraints
- Designed specifically for mcp-debugger package structure
- Assumes esbuild metafile format for bundle analysis
- JavaScript adapter presence is critical for npm distribution