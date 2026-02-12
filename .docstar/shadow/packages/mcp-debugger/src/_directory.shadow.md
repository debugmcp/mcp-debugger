# packages\mcp-debugger\src/
@generated: 2026-02-12T21:00:55Z

## Overall Purpose
The `packages/mcp-debugger/src` directory serves as the core distribution and entry point layer for the MCP (Model Context Protocol) debugger CLI tool. It orchestrates the bundling of language adapters and provides a protocol-compliant CLI interface that can be safely used with npx and various MCP transport modes.

## Key Components and Architecture

### Adapter Bundle Management (`batteries-included.ts`)
- **Static Registry**: Maintains a global registry of all available debugger adapters (JavaScript, Python, Mock)
- **Bundle Inclusion**: Ensures esbuild includes all adapters in the CLI distribution through static imports
- **Global Discovery Pattern**: Uses `__DEBUG_MCP_BUNDLED_ADAPTERS__` global key for cross-module adapter discovery
- **Deduplication**: Prevents duplicate adapter registrations using Set-based language key tracking

### CLI Entry Point (`cli-entry.ts`) 
- **Protocol Compliance Layer**: Critical console silencing logic to prevent stdout pollution in MCP transport modes
- **Bootstrap Orchestration**: Coordinates initialization sequence between adapter bundling and main implementation
- **Transport Detection**: Intelligently detects stdio/SSE transport modes from arguments and environment
- **Error Handling**: Protocol-aware error reporting that respects console silencing requirements

## Public API and Entry Points

### Primary Entry Point
- **`cli-entry.ts`**: Main CLI entry point for npx usage
  - Handles all transport modes (stdio, SSE, direct)
  - Provides protocol-safe console handling
  - Bootstraps complete debugger environment

### Internal Integration Points
- **Global Adapter Registry**: `globalThis.__DEBUG_MCP_BUNDLED_ADAPTERS__` - discoverable adapter collection
- **Environment Coordination**: Uses `CONSOLE_OUTPUT_SILENCED` and `DEBUG_MCP_SKIP_AUTO_START` flags for cross-module communication

## Data Flow and Integration

1. **Module Loading Sequence**: 
   - Console silencing executes first (critical for protocol compliance)
   - Adapter bundling registration via `batteries-included.ts`
   - Dynamic import of main implementation to avoid premature loading

2. **Adapter Discovery Flow**:
   - Language adapters register themselves in global registry on module load
   - Main implementation discovers adapters through global registry lookup
   - Factory pattern enables runtime adapter instantiation

3. **CLI Bootstrap Process**:
   - Argument parsing and transport detection
   - Protocol-appropriate console configuration  
   - Coordinated initialization with skip flags
   - Error handling respecting transport requirements

## Important Patterns and Conventions

- **Side-Effect Based Registration**: Adapters self-register through module import side effects
- **Global State Management**: Uses global object pattern for adapter discovery while maintaining safety through deduplication
- **Protocol-First Design**: All console output carefully managed to maintain MCP protocol compliance
- **Dynamic Import Strategy**: Strategic use of dynamic imports to control module loading sequence
- **Environment Flag Coordination**: Cross-module communication through well-defined environment variables

This directory essentially serves as the "distribution layer" - it packages everything needed for the MCP debugger CLI while ensuring protocol compliance and providing a clean entry point for various usage scenarios.