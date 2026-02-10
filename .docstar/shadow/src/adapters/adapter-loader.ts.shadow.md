# src/adapters/adapter-loader.ts
@source-hash: 54dee150d563b36c
@generated: 2026-02-09T18:15:04Z

## Primary Purpose
Dynamic adapter loading system for a debug MCP framework. Handles runtime discovery, loading, and caching of language-specific debugger adapters with fallback resolution strategies for different deployment contexts.

## Key Interfaces & Types
- **ModuleLoader** (L7-9): Abstraction for dynamic module loading, enabling testability and custom import strategies
- **AdapterMetadata** (L11-16): Structure describing adapter availability and package information

## Core Class: AdapterLoader (L18-190)
Central orchestrator for adapter lifecycle management with dependency injection support.

### Key Methods
- **loadAdapter(language)** (L42-120): Primary entry point for dynamic adapter loading with multi-stage fallback resolution:
  1. Cache lookup
  2. Package name resolution via npm naming convention
  3. Primary dynamic import attempt
  4. Fallback to monorepo/development paths (L60-88)
  5. CommonJS compatibility layer via createRequire (L71-81)
  6. Factory class instantiation and caching
  
- **isAdapterAvailable(language)** (L125-132): Non-throwing availability check, leverages loadAdapter internally
- **listAvailableAdapters()** (L137-162): Returns hardcoded registry of known adapters with runtime availability status

### Architecture Patterns
- **Caching Strategy**: Map-based instance cache (L19) prevents redundant loading
- **Dependency Injection**: Constructor accepts custom logger and module loader (L23-26)
- **Fallback Resolution**: Multi-path module loading for development vs production deployments
- **Error Handling**: Distinguishes between missing packages vs loading errors with actionable error messages (L104-119)

### Critical Dependencies
- `@debugmcp/shared.IAdapterFactory`: Core adapter interface contract
- Winston logger for structured logging
- Node.js ES modules (`import()`, `createRequire`, `import.meta.url`)

### Naming Conventions
- Package names: `@debugmcp/adapter-${language}` (L165)
- Factory classes: `${Language}AdapterFactory` (L186-189)
- Fallback paths support both node_modules and monorepo structures (L179-184)

### Deployment Context Handling
Supports multiple runtime environments:
- Production: npm packages in node_modules
- Development: monorepo packages structure
- Bundled: CommonJS compatibility via createRequire

## Known Adapters Registry
Hardcoded list includes: mock, python, javascript, java, rust, go (L138-145)