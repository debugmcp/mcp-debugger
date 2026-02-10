# src/adapters/adapter-loader.ts
@source-hash: 7b5a859df5910ddc
@generated: 2026-02-10T01:18:59Z

**Primary Purpose**: Dynamic adapter loading system that manages loading and caching of debug adapters for different programming languages in the DebugMCP ecosystem.

**Core Architecture**: The AdapterLoader (L18-179) implements a robust module loading system with fallback mechanisms for different deployment scenarios (npm packages, monorepos, bundled contexts). Uses caching to avoid repeated loading operations.

**Key Interfaces**:
- `ModuleLoader` (L7-9): Abstracts module loading mechanism for testability
- `AdapterMetadata` (L11-16): Describes adapter package information including installation status

**Key Methods**:
- `loadAdapter(language)` (L42-120): Main entry point for dynamic adapter loading with sophisticated fallback chain
- `isAdapterAvailable(language)` (L125-132): Availability checker that leverages loadAdapter with exception handling
- `listAvailableAdapters()` (L137-162): Returns hardcoded list of known adapters with installation status

**Loading Strategy**:
1. Cache check (L44-46)
2. Primary import by package name (L57)
3. Fallback to monorepo paths (L60-88) using both ESM import and CommonJS require
4. Factory class instantiation using naming convention (L94-102)

**Fallback Mechanisms**:
- Multiple module resolution paths (L169-174): node_modules and packages directories
- Dual loading approach: ESM dynamic import + CommonJS createRequire (L72-77)
- Comprehensive error handling with specific messaging for missing modules (L104-119)

**Dependencies**:
- `@debugmcp/shared.IAdapterFactory`: Core adapter interface
- Winston logger for debugging and error reporting
- Node.js module utilities (createRequire, fileURLToPath)

**Naming Conventions**:
- Package names: `@debugmcp/adapter-{language}` (L165)
- Factory classes: `{Language}AdapterFactory` (L176-179)

**Critical Constraints**:
- Adapters must export factory classes following naming convention
- Caching prevents duplicate loading but requires cache invalidation for updates
- Fallback paths are hardcoded to specific directory structures