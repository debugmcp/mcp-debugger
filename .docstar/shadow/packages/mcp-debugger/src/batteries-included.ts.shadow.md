# packages\mcp-debugger\src\batteries-included.ts
@source-hash: 2b3f8be929735b87
@generated: 2026-02-15T09:00:52Z

## Primary Purpose
Registry module that statically imports all MCP debugger adapters to ensure they're bundled into the CLI for "batteries included" distribution. Creates a global registry accessible across the application.

## Key Components

**BundledAdapterEntry Interface (L16-19)**
- Defines structure for adapter registry entries
- Maps language identifiers to adapter factory constructors
- Supports 'javascript', 'python', 'mock', 'go' languages

**Global Registry Pattern (L21, L30-40)**
- Uses `__DEBUG_MCP_BUNDLED_ADAPTERS__` global key for cross-module adapter access
- Implements deduplication logic to prevent duplicate adapter registrations
- Falls back to creating new registry if none exists

**Static Adapter Imports (L10-13)**
- Forces esbuild to include all adapter packages in bundle
- Imports: JavascriptAdapterFactory, PythonAdapterFactory, MockAdapterFactory, GoAdapterFactory
- All implement IAdapterFactory interface from @debugmcp/shared

**Adapter Registration Array (L23-28)**
- Static configuration mapping language strings to factory constructors
- Extensible design for adding new language adapters

## Dependencies
- `@debugmcp/adapter-javascript` - JavaScript debugging adapter
- `@debugmcp/adapter-python` - Python debugging adapter  
- `@debugmcp/adapter-mock` - Mock/testing adapter
- `@debugmcp/adapter-go` - Go debugging adapter
- `@debugmcp/shared` - Common interfaces and types

## Architectural Patterns
- **Global Registry**: Uses globalThis for cross-module state sharing
- **Factory Pattern**: Stores constructor references rather than instances
- **Deduplication**: Prevents duplicate adapter registrations via Set-based checking
- **Side-Effect Module**: Executes registration logic on import, exports empty object for module compliance

## Critical Behavior
- Registration happens at module load time
- Deduplication based on language string matching
- Global state persists across multiple imports of this module