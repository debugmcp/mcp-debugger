# packages\mcp-debugger\src/
@children-hash: 3a50743f6ece7df6
@generated: 2026-02-15T09:01:23Z

## Overall Purpose

The `packages/mcp-debugger/src` directory serves as the core entry point and bootstrapping infrastructure for the MCP (Model Context Protocol) debugger CLI application. This module handles two critical responsibilities: ensuring a "batteries-included" distribution with all debugging adapters bundled, and providing a protocol-compliant CLI entry point that prevents stdout contamination.

## Key Components and Integration

### Adapter Bundling System (`batteries-included.ts`)
- **Global Registry**: Creates a cross-module adapter registry using `__DEBUG_MCP_BUNDLED_ADAPTERS__` global key
- **Static Bundling**: Forces esbuild to include all adapter packages (JavaScript, Python, Mock, Go) in the final CLI distribution
- **Factory Pattern**: Stores adapter constructor references for lazy instantiation
- **Deduplication Logic**: Prevents duplicate adapter registrations across module imports

### CLI Entry Point (`cli-entry.ts`) 
- **Protocol Compliance**: Critical console silencing before any imports to prevent MCP protocol corruption
- **Transport Detection**: Auto-detects stdio/SSE transport modes and silences output accordingly
- **Bootstrap Coordination**: Sets environment flags and delegates to main implementation
- **Error Handling**: Respects silencing state to maintain protocol integrity

## Data Flow and Interaction

1. **CLI Invocation**: `cli-entry.ts` executes first as the npx entry point
2. **Console Silencing**: Immediately analyzes arguments and silences console output if using transport protocols
3. **Adapter Registration**: Imports `batteries-included.ts` to populate the global adapter registry
4. **Main Delegation**: Dynamically imports and executes the root implementation with processed arguments
5. **Runtime Access**: Main application accesses bundled adapters via the global registry

## Public API Surface

### Primary Entry Point
- **CLI Command**: Accessible via npx as the main debugger interface
- **Argument Processing**: Handles transport configuration (stdio, SSE), debugging options, and adapter selection

### Global Registry Interface
- **`__DEBUG_MCP_BUNDLED_ADAPTERS__`**: Global registry containing all bundled adapter factories
- **BundledAdapterEntry**: Standard interface mapping language identifiers to adapter constructors
- **Supported Adapters**: javascript, python, mock, go

## Internal Organization

### Bootstrapping Sequence
1. **Pre-import Setup**: Console silencing and argument normalization
2. **Adapter Bundling**: Static import and registration of all debugging adapters  
3. **Environment Coordination**: Flag setting for cross-module communication
4. **Main Execution**: Dynamic import and delegation to core implementation

### Critical Patterns
- **IIFE Execution**: Immediate console silencing before any module imports
- **Global State Management**: Cross-module adapter registry using globalThis
- **Dynamic Imports**: Prevents premature loading during critical setup phases
- **Protocol Safety**: Comprehensive stdout protection for MCP compliance

## Architectural Significance

This directory implements the foundation layer that enables the MCP debugger to function as both a standalone CLI tool and a protocol-compliant MCP server. The separation between bundling (`batteries-included.ts`) and CLI entry (`cli-entry.ts`) ensures clean separation of concerns while maintaining the critical ordering requirements for MCP protocol compliance.