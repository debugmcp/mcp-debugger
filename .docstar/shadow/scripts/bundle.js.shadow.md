# scripts/bundle.js
@source-hash: e446cc34cebb3883
@generated: 2026-02-09T18:15:15Z

## Purpose
Node.js script that bundles the MCP debugger server using esbuild, creating two production bundles: a main server bundle and a debug adapter proxy bundle. Critical feature: injects console silencing code to prevent stdout pollution in MCP transport modes.

## Key Functions

### `bundle()` (L10-173)
Main bundling function that orchestrates the entire process:
- Creates main server bundle from `dist/index.js` → `dist/bundle.cjs` (L15-34)
- Injects console silencing header to prevent MCP protocol corruption (L40-102)
- Creates proxy bundle from `dist/proxy/dap-proxy-entry.js` → `dist/proxy/proxy-bundle.cjs` (L131-150)
- Performs bundle analysis and size reporting (L118-127, L152-167)

## Bundle Configurations

### Main Bundle (L15-34)
- **Entry**: `dist/index.js`
- **Output**: `dist/bundle.cjs` (CommonJS, Node 18+, minified)
- **External**: `fsevents` (native module)
- **Defines**: Hardcoded paths for `import.meta.url` and `__dirname`

### Proxy Bundle (L131-150) 
- **Entry**: `dist/proxy/dap-proxy-entry.js`
- **Output**: `dist/proxy/proxy-bundle.cjs` (CommonJS, Node 20+, unminified)
- **External**: None (bundles all dependencies)
- **Features**: Inline sourcemaps, name preservation for debugging

## Critical Implementation Details

### Console Silencing (L39-99)
Injects sophisticated argument parsing logic to detect MCP transport modes:
- **Transport Detection**: Matches `stdio`, `sse` keywords in various formats (L52-67)
- **Silencing**: Overrides all console methods with no-ops when transport detected (L73-91)
- **Argv Cleaning**: Strips quotes from command line arguments (L94-97)

### Post-Processing (L40-44, L101-102)
- Removes embedded shebang lines from bundle content
- Prepends custom shebang + console silencer to final bundle

## Dependencies
- **esbuild**: Primary bundling engine
- **fs**: File operations (reading, writing, copying)
- **path**: Path manipulation for proxy bootstrap copying

## File Operations
- Writes metafile for bundle analysis: `dist/bundle-meta.json` (L37)
- Conditionally copies `src/proxy/proxy-bootstrap.js` → `dist/proxy/proxy-bootstrap.js` (L104-115)
- Creates proxy directory structure as needed (L109-112)

## Error Handling
Process exits with code 1 on bundling failures (L166, L171) or missing proxy bundle (L165-167).