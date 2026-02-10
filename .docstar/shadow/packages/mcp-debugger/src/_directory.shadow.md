# packages/mcp-debugger/src/
@generated: 2026-02-09T18:16:05Z

## Overall Purpose
The `packages/mcp-debugger/src` directory contains the CLI entry point and adapter bootstrap system for the MCP debugger. It provides a batteries-included distribution that bundles all supported language adapters and creates a standalone CLI tool compatible with MCP transport protocols.

## Key Components & Relationships

### CLI Entry System
- **cli-entry.ts**: Primary CLI entry point that handles MCP protocol compatibility through intelligent console output management
- **batteries-included.ts**: Adapter registration bootstrap that ensures all language adapters are bundled and available

### Component Interaction Flow
1. **CLI Invocation**: `cli-entry.ts` executes first, detecting transport mode and silencing console output if needed for MCP protocol compatibility
2. **Adapter Bootstrap**: Imports `batteries-included.ts` to register all supported language adapters (JavaScript, Python, Mock) in global registry
3. **Core Execution**: Dynamically imports and delegates to the main debugger implementation with proper environment setup

### Global Registry Architecture
- **Singleton Pattern**: Uses `globalThis.__DEBUG_MCP_BUNDLED_ADAPTERS__` for centralized adapter storage
- **Factory Pattern**: All adapters implement `IAdapterFactory` interface for consistent instantiation
- **Duplicate Prevention**: Set-based deduplication prevents multiple registrations of same adapter type

## Public API Surface

### Primary Entry Points
- **CLI Tool**: `cli-entry.ts` serves as the main executable entry point for npx usage
- **Adapter Registry**: Global adapter registry accessible via `globalThis.__DEBUG_MCP_BUNDLED_ADAPTERS__`

### Supported Language Adapters
- JavaScript/Node.js debugging via `JavascriptAdapterFactory`
- Python debugging via `PythonAdapterFactory`  
- Mock/testing via `MockAdapterFactory`

## Internal Organization & Data Flow

### Bootstrap Sequence
1. Console output silencing detection and activation (transport-aware)
2. Quote normalization for CLI arguments
3. Static adapter import and global registry initialization
4. Environment variable coordination (`DEBUG_MCP_SKIP_AUTO_START=1`)
5. Dynamic core module loading and execution

### MCP Protocol Compatibility
- Automatic detection of `stdio` and `sse` transport modes
- Console silencing to prevent stdout pollution during MCP communication
- Environment variable coordination between CLI shim and core implementation

## Important Patterns & Conventions

### Early Initialization Pattern
- IIFE execution before imports to ensure console silencing takes effect
- Static imports force esbuild bundling rather than dynamic loading
- Global registry setup happens at module load time

### Error Handling Strategy
- Dual-level error handling that respects console silencing state
- Fail-fast approach with appropriate exit codes
- MCP protocol preservation takes precedence over error visibility

### Environment Coordination
- Uses environment variables to coordinate behavior between CLI shim and core module
- Detects piped stdin to determine default console silencing behavior
- Maintains compatibility across different execution contexts (direct vs npx vs MCP server)