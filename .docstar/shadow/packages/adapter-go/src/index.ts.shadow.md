# packages/adapter-go/src/index.ts
@source-hash: 11dc8fd48d90cd4a
@generated: 2026-02-10T00:41:13Z

**Primary Purpose**: Entry point module for the Go Debug Adapter package, providing Go debugging capabilities through Delve (dlv) with native Debug Adapter Protocol (DAP) support for the mcp-debugger system.

**Key Exports**:
- `GoDebugAdapter` (L10) - Main debug adapter class imported from go-debug-adapter.js
- `GoAdapterFactory` (L11) - Factory class for creating Go debug adapter instances
- Go utilities (L12) - All exports from utils/go-utils.js module
- Default export (L15-18) - Required adapter configuration object with name 'go' and factory reference for dynamic loading

**Architecture**:
- Follows mcp-debugger's dynamic adapter loading pattern via default export structure
- Uses ES module dynamic imports for factory instantiation (L17)
- Implements standard adapter interface with name/factory pattern

**Dependencies**:
- `./go-debug-adapter.js` - Core adapter implementation
- `./go-adapter-factory.js` - Factory for adapter creation
- `./utils/go-utils.js` - Go-specific utility functions

**Integration Notes**:
- Default export structure enables runtime discovery by mcp-debugger's dynamic loader
- Async import pattern ensures proper module resolution in dynamic loading scenarios