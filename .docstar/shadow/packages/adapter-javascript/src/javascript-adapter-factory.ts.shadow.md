# packages/adapter-javascript/src/javascript-adapter-factory.ts
@source-hash: f9d07a7d072ff717
@generated: 2026-02-10T00:41:23Z

## JavaScript Adapter Factory

**Primary Purpose**: Factory implementation for creating JavaScript/TypeScript debug adapter instances, extending the shared AdapterFactory pattern to provide language-specific validation and instantiation.

### Key Components

**JavascriptAdapterFactory (L36-138)**: Main factory class extending BaseAdapterFactory
- Constructor (L37-39): Initializes with predefined metadata
- `validate()` (L47-131): Comprehensive environment validation for JS/TS debugging
- `createAdapter()` (L136-138): Instantiates JavascriptDebugAdapter with dependencies

**Metadata Configuration (L21-31)**: Static adapter metadata defining:
- Language support: JavaScript/TypeScript with 8 file extensions (L28)
- Version and compatibility requirements (L24, L27)
- Placeholder SVG icon (base64-encoded, L30)

### Validation Logic (L47-131)

**Node.js Version Check (L52-60)**: 
- Parses version string using regex (L54-57)
- Requires major version ≥ 14, adds error if not met

**Vendor Dependency Check (L64-76)**:
- Resolves js-debug adapter path relative to current file location (L64-66)
- Validates existence of `vsDebugServer.js` in vendor directory
- Safe error handling for filesystem operations (L73-75)

**TypeScript Runner Detection (L78-118)**:
- Platform-aware executable extension handling (L79-80)
- Checks both local `node_modules/.bin` and system PATH
- Searches for `tsx` and `ts-node` executables
- Generates warnings (not errors) if neither found

### Dependencies

- **Internal**: `@debugmcp/shared` (AdapterFactory, types), `./javascript-debug-adapter.js`
- **Node.js Built-ins**: `fs`, `path`, `url.fileURLToPath`

### Architecture Notes

- Follows factory pattern with validation-before-creation semantics
- Path resolution works for both development (`src/`) and production (`dist/`) contexts
- Defensive programming with safe filesystem operations and fallback error handling
- Separation of critical errors (Node.js version, vendor files) from warnings (TS runners)