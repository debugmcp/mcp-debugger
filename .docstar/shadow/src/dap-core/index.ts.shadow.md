# src/dap-core/index.ts
@source-hash: 4a07c015e28495f7
@generated: 2026-02-09T18:14:56Z

**Primary Purpose:** Module entry point that aggregates and re-exports the functional core components of the Debug Adapter Protocol (DAP) implementation.

**Key Exports:**
- Types definitions (L6) - Re-exported from `./types.js`
- State management functions (L9) - Re-exported from `./state.js` 
- Protocol handlers (L12) - Re-exported from `./handlers.js`

**Architecture:** Follows a barrel export pattern, providing a single import point for all DAP core functionality. The module acts as a facade that consolidates three key subsystems:
1. Type definitions for DAP protocol structures
2. State management utilities for debugging session state
3. Request/response handlers for DAP protocol messages

**Dependencies:** 
- `./types.js` - Core DAP type definitions
- `./state.js` - State management utilities
- `./handlers.js` - Protocol message handlers

**Usage Pattern:** Enables consumers to import all DAP core functionality via a single import statement rather than importing from individual modules.