# packages/adapter-go/src/index.ts
@source-hash: 11dc8fd48d90cd4a
@generated: 2026-02-09T18:15:02Z

**Primary Purpose:** Entry point module for the Go Debug Adapter package, providing Go debugging support through Delve (dlv) with native DAP protocol integration for the mcp-debugger system.

**Key Exports:**
- `GoDebugAdapter` (L10) - Main debug adapter class imported from go-debug-adapter.js
- `GoAdapterFactory` (L11) - Factory class for creating Go debug adapter instances
- Go utilities (L12) - Re-exported utility functions from utils/go-utils.js
- Default export (L15-18) - Required adapter configuration object for mcp-debugger's dynamic loader system

**Architecture Patterns:**
- **Module Re-export Pattern**: Acts as a barrel export aggregating core functionality
- **Dynamic Loading Support**: Default export structure specifically designed for mcp-debugger's runtime adapter loading
- **Factory Pattern**: Exposes factory class for standardized adapter instantiation

**Dependencies:**
- `./go-debug-adapter.js` - Core adapter implementation
- `./go-adapter-factory.js` - Factory for adapter creation  
- `./utils/go-utils.js` - Go-specific utility functions

**Critical Design Decisions:**
- Uses top-level await (L17) for dynamic import in default export, enabling lazy loading
- Default export provides standardized interface (`name`, `factory`) expected by mcp-debugger loader
- Maintains separation between named exports (direct access) and default export (loader integration)