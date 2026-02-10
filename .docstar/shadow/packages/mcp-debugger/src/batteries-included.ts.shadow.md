# packages/mcp-debugger/src/batteries-included.ts
@source-hash: 08080fa3e5673837
@generated: 2026-02-10T00:41:21Z

**Purpose**: Bundle registration module that statically imports all MCP debugger adapters to ensure they're included in the CLI distribution bundle via esbuild.

**Key Components**:

- **BundledAdapterEntry Interface (L15-18)**: Type definition for adapter registry entries containing language identifier and factory constructor
- **GLOBAL_KEY Constant (L20)**: Global namespace key `__DEBUG_MCP_BUNDLED_ADAPTERS__` for storing adapter registry
- **Adapters Array (L22-26)**: Static registry of three bundled adapters:
  - JavaScript adapter (`JavascriptAdapterFactory`)
  - Python adapter (`PythonAdapterFactory`) 
  - Mock adapter (`MockAdapterFactory`)
- **Global Registration Logic (L28-38)**: Safely registers adapters to global scope, merging with existing entries or creating new registry

**Dependencies**:
- `@debugmcp/adapter-javascript` - JavaScript language adapter
- `@debugmcp/adapter-python` - Python language adapter  
- `@debugmcp/adapter-mock` - Mock testing adapter
- `@debugmcp/shared` - Core interfaces (`IAdapterFactory`)

**Architectural Pattern**: 
Uses global object pattern for cross-module adapter discovery while preventing duplicate registrations through Set-based deduplication by language key.

**Key Behavior**: 
Module executes registration side-effects on import, making adapters discoverable to other parts of the system without explicit dependency injection. The empty export `export {}` satisfies module requirements while focusing on side-effects.