# packages/mcp-debugger/src/batteries-included.ts
@source-hash: 08080fa3e5673837
@generated: 2026-02-09T18:14:33Z

## Primary Purpose
Bootstraps adapter registration for a batteries-included MCP debugger distribution. Ensures all supported language adapters are statically imported and bundled into the CLI, then registers them in a global registry to prevent duplicates.

## Key Components

### Adapter Imports (L10-13)
- **JavascriptAdapterFactory**: JavaScript/Node.js debugging adapter
- **PythonAdapterFactory**: Python debugging adapter  
- **MockAdapterFactory**: Mock/testing adapter
- **IAdapterFactory**: TypeScript interface for adapter factory pattern

### Data Structures
- **BundledAdapterEntry** (L15-18): Type definition for adapter registry entries with language identifier and factory constructor
- **GLOBAL_KEY** (L20): Global namespace key `__DEBUG_MCP_BUNDLED_ADAPTERS__` for adapter storage
- **adapters** (L22-26): Static array of all bundled adapter configurations

### Registration Logic (L28-38)
Global adapter registry initialization with duplicate prevention:
- Checks if global registry already exists
- If exists: merges new adapters while avoiding language duplicates using Set-based deduplication
- If not exists: initializes global registry with adapter array copy

## Architectural Patterns
- **Global Singleton Registry**: Uses globalThis to maintain single adapter registry across modules
- **Static Import Strategy**: Forces esbuild bundling through direct imports rather than dynamic loading
- **Factory Pattern**: All adapters implement IAdapterFactory interface for consistent instantiation
- **Duplicate Prevention**: Set-based language checking prevents multiple registrations of same adapter type

## Critical Constraints
- Must be imported early in application lifecycle to ensure adapter availability
- Global registry mutation is not thread-safe (assumes single-threaded Node.js environment)
- Adapter factories must have parameterless constructors for instantiation pattern