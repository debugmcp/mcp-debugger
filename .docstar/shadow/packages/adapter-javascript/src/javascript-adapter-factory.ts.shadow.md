# packages/adapter-javascript/src/javascript-adapter-factory.ts
@source-hash: f9d07a7d072ff717
@generated: 2026-02-09T18:14:33Z

## Primary Purpose
Factory class for creating JavaScript/TypeScript debug adapter instances. Extends the shared `BaseAdapterFactory` to provide language-specific validation and instantiation logic for JavaScript/TypeScript debugging environments.

## Key Components

### AdapterMetadata Configuration (L21-31)
Static metadata object defining JavaScript adapter characteristics:
- Supports 8 file extensions: `.js`, `.mjs`, `.cjs`, `.jsx`, `.ts`, `.tsx`, `.mts`, `.cts`
- Requires minimum debugger version 2.0.0
- Contains placeholder base64 SVG icon

### JavascriptAdapterFactory Class (L36-139)
Primary factory class extending `BaseAdapterFactory`:
- **Constructor (L37-39)**: Passes metadata to base class
- **validate() (L47-131)**: Comprehensive environment validation with three checks:
  1. Node.js version ≥14 validation using regex parsing (L52-60)
  2. Bundled js-debug adapter presence at `../vendor/js-debug/vsDebugServer.js` (L62-76)
  3. TypeScript runner detection for tsx/ts-node in local and PATH locations (L78-118)
- **createAdapter() (L136-138)**: Factory method returning `JavascriptDebugAdapter` instance

## Dependencies
- **@debugmcp/shared**: Base factory classes and interfaces
- **Local**: `JavascriptDebugAdapter` from same package
- **Node.js built-ins**: fs, path, url modules

## Architecture Patterns
- **Factory Pattern**: Implements adapter creation with dependency injection
- **Validation Chain**: Multi-stage environment validation with errors vs warnings distinction
- **Cross-platform Support**: Windows-aware executable detection with extension handling (L79-81)
- **Path Resolution**: ESM-compatible path resolution using `import.meta.url` (L64-66)

## Key Behaviors
- **Graceful Degradation**: TypeScript runners generate warnings, not errors
- **Safe File Operations**: Error-catching wrappers for filesystem calls (L82-88)
- **Short-circuit Optimization**: Early exit when both TypeScript runners found (L113)
- **Flexible Vendor Path**: Works from both src and dist directories due to sibling vendor directory

## Validation Result Structure
Returns `FactoryValidationResult` with:
- Boolean validity based on error count
- Separate error/warning arrays
- Detailed validation context including Node version and tool availability