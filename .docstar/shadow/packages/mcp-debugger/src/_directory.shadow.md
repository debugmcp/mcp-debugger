# packages/mcp-debugger/src/
@generated: 2026-02-10T01:19:36Z

## Overall Purpose

The `packages/mcp-debugger/src` directory serves as the CLI distribution layer for the MCP debugger system, providing bundled adapter registration and protocol-compliant entry point management. This module bridges the gap between the core debugger implementation and external CLI usage, ensuring proper adapter availability and MCP protocol compliance.

## Key Components and Architecture

### Adapter Bundle Management (`batteries-included.ts`)
- **Static Adapter Registry**: Pre-bundles JavaScript, Python, and Mock adapters using global namespace pattern
- **Global Registration System**: Uses `__DEBUG_MCP_BUNDLED_ADAPTERS__` key for cross-module adapter discovery
- **Side-Effect Based Loading**: Executes adapter registration on import to ensure availability without explicit dependency injection
- **Deduplication Logic**: Prevents duplicate adapter registrations through Set-based language key tracking

### CLI Entry Point (`cli-entry.ts`)
- **Protocol Compliance Layer**: Critical console silencing to prevent stdout pollution in MCP transport modes
- **Bootstrap Coordination**: Manages initialization order and flag coordination with main implementation
- **Transport Detection**: Intelligent detection of stdio/SSE transport modes from arguments and environment
- **Error Handling**: Conditional logging that respects console silencing state

## Data Flow and Integration

1. **CLI Invocation**: `cli-entry.ts` serves as the primary entry point for npx usage
2. **Console Management**: Immediate console silencing before any imports to maintain protocol compliance
3. **Adapter Loading**: Dynamic import of `batteries-included.js` ensures all adapters are bundled
4. **Main Delegation**: Bootstrap process imports and delegates to root implementation with proper flag coordination

## Public API Surface

### Primary Entry Points
- **CLI Entry**: `cli-entry.ts` - Main entry point for CLI usage
- **Adapter Registry**: Global `__DEBUG_MCP_BUNDLED_ADAPTERS__` - Discoverable adapter collection

### Key Interfaces
- **BundledAdapterEntry**: Type definition for adapter registry entries
- **Environment Flags**: `CONSOLE_OUTPUT_SILENCED`, `DEBUG_MCP_SKIP_AUTO_START` for cross-module coordination

## Important Patterns and Conventions

### Global Registry Pattern
Uses global object storage for adapter discovery, enabling loose coupling between adapter implementations and the main debugger system.

### Protocol-First Design
Prioritizes MCP protocol compliance over developer convenience, with mandatory console silencing for transport modes.

### Initialization Coordination
Employs environment flags and careful import ordering to prevent initialization races and duplicate processes.

### Bundle Integration
Leverages esbuild static analysis through explicit imports to ensure adapter availability in distributed CLI builds.

## Critical Dependencies

- **Core Adapters**: JavaScript, Python, and Mock adapter packages
- **Shared Interfaces**: `@debugmcp/shared` for common types
- **Root Implementation**: Main debugger logic via dynamic import
- **Build System**: esbuild for static bundling and tree-shaking

This module ensures that the MCP debugger can be distributed as a standalone CLI tool while maintaining protocol compliance and adapter ecosystem integration.