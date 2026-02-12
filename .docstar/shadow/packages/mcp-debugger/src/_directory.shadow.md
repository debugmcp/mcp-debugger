# packages\mcp-debugger\src/
@generated: 2026-02-12T21:05:44Z

## Overall Purpose and Responsibility

The `packages/mcp-debugger/src` directory serves as the core entry point and adapter bundling system for the MCP (Model Context Protocol) debugger CLI tool. This module is responsible for orchestrating the initialization sequence, ensuring protocol compliance, and providing a complete runtime environment with all necessary debugging adapters.

## Key Components and Relationships

### Entry Point Architecture
- **cli-entry.ts**: Primary CLI entry point that handles critical initialization sequence including console silencing for MCP transport protocol compliance
- **batteries-included.ts**: Adapter bundling module that statically imports and globally registers all available debugging adapters

### Initialization Flow
1. **Console Silencing Phase**: `cli-entry.ts` immediately detects transport modes (stdio/SSE) and silences console output to prevent MCP protocol corruption
2. **Adapter Registration Phase**: Dynamic import of `batteries-included.ts` ensures all adapters are bundled and registered in global scope
3. **Bootstrap Phase**: Main implementation is dynamically imported and executed with proper flag coordination

## Public API Surface

### Main Entry Points
- **CLI Entry**: `cli-entry.ts` serves as the primary entry point for npx usage and CLI execution
- **Adapter Discovery**: Global registry accessible via `__DEBUG_MCP_BUNDLED_ADAPTERS__` key for runtime adapter lookup

### Supported Debugging Adapters
- **JavaScript Adapter**: Full JavaScript/Node.js debugging capabilities
- **Python Adapter**: Python runtime debugging support  
- **Mock Adapter**: Testing and development adapter for simulation scenarios

## Internal Organization and Data Flow

### Critical Initialization Sequence
1. **Argument Processing**: Parse and normalize CLI arguments with quote stripping
2. **Transport Detection**: Analyze arguments, environment variables, and stdin state to determine MCP transport mode
3. **Console Silencing**: Conditionally disable all console methods when stdio/SSE transport is active
4. **Dynamic Loading**: Import adapters and main implementation after console state is properly configured
5. **Bootstrap Coordination**: Set environment flags to prevent duplicate initialization

### Global State Management
- Uses global object pattern (`__DEBUG_MCP_BUNDLED_ADAPTERS__`) for cross-module adapter discovery
- Environment flags (`CONSOLE_OUTPUT_SILENCED`, `DEBUG_MCP_SKIP_AUTO_START`) coordinate initialization state
- Set-based deduplication prevents duplicate adapter registrations

## Important Patterns and Conventions

### Protocol Compliance Pattern
The module implements a strict initialization order where console silencing MUST occur before any imports to maintain MCP transport protocol integrity. This is achieved through IIFE execution and dynamic imports.

### Bundling Strategy
Static imports in `batteries-included.ts` ensure esbuild includes all adapters in the distribution bundle, while runtime registration makes them discoverable without explicit dependency injection.

### Error Handling
Conditional error reporting respects console silencing state - errors are logged only when console output is safe, maintaining protocol compliance even during failure scenarios.

### Flexible Argument Processing
Supports multiple argument formats (exact matches, key=value pairs, quoted/unquoted) with normalization for robust CLI interaction.

This directory represents a carefully orchestrated initialization system that balances the needs of CLI usability, MCP protocol compliance, and comprehensive debugging adapter availability.