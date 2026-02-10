# packages/mcp-debugger/
@generated: 2026-02-10T21:26:41Z

## MCP Debugger CLI Distribution Module

**Purpose:** Complete CLI distribution pipeline for the MCP debugger, handling both build automation and runtime execution. This module transforms the TypeScript debugger implementation into a distributable npm package while ensuring proper protocol compliance and adapter bundling for production use.

## Key Components and Integration

### Build Infrastructure (`scripts/`)
**bundle-cli.js** - Production build orchestrator that creates distributable artifacts:
- Bundles TypeScript CLI entry points using tsup
- Generates both ESM and CommonJS formats for broad compatibility
- Integrates platform-specific debug adapters (JavaScript, Rust/CodeLLDB)
- Creates npm-ready packages with all runtime dependencies

### CLI Runtime Layer (`src/`)
**cli-entry.ts** - Main executable entry point optimized for npx usage:
- **Protocol Compliance Engine**: Silences console output for stdio/SSE transports to prevent MCP protocol corruption
- **Dynamic Bootstrap**: Coordinates initialization flags and lazy-loads the main debugger application
- **Command-line Processing**: Handles argument parsing with proper quote stripping

**batteries-included.ts** - Adapter bundling system:
- **Static Import Registry**: Forces build tools to include all debugger adapters (JavaScript, Python, Mock) in the CLI bundle
- **Global Discovery Pattern**: Uses `__DEBUG_MCP_BUNDLED_ADAPTERS__` namespace to make adapters available system-wide
- **Factory Management**: Maintains type-safe registry of `IAdapterFactory` implementations

## Public API Surface

### Primary Entry Points
- **CLI Distribution**: `npx @modelcontextprotocol/debugger` - Main user-facing command
- **Build Pipeline**: `node scripts/bundle-cli.js` - Creates distribution artifacts
- **Direct Execution**: Node.js compatible entry point with transport detection

### Adapter Discovery API
- **Global Registry**: `globalThis.__DEBUG_MCP_BUNDLED_ADAPTERS__` provides access to bundled adapters
- **Automatic Integration**: JavaScript, Python, and Mock adapters available without additional setup
- **Factory Pattern**: Standardized `IAdapterFactory` interface for adapter instantiation

## Internal Organization and Data Flow

### Build-to-Runtime Pipeline
```
TypeScript Source → Bundle Generation → Adapter Integration → Distribution → Runtime Execution
```

1. **Build Phase** (`scripts/`):
   - TypeScript compilation with Node.js targeting
   - Multi-format bundling (ESM/CommonJS) 
   - Platform-specific debug adapter integration
   - Vendor asset copying and npm packaging

2. **Runtime Phase** (`src/`):
   - Pre-import console management for protocol compliance
   - Adapter registration through static imports
   - Environment coordination between CLI and main application
   - Dynamic application bootstrap with proper flag coordination

### Cross-Component Communication
- **Environment Variables**: `CONSOLE_OUTPUT_SILENCED`, `DEBUG_MCP_SKIP_AUTO_START` coordinate between layers
- **Global Object Pattern**: Adapter discovery without explicit dependency injection
- **Build-Runtime Coordination**: Build scripts prepare assets that runtime components expect

## Important Patterns and Conventions

### Protocol Compliance Strategy
- **Console Silencing**: Critical pre-import logic prevents MCP protocol corruption
- **Transport Detection**: Intelligent identification of stdio/SSE modes
- **Error Handling**: Respects protocol requirements in failure scenarios

### Distribution Architecture
- **Multi-Platform Support**: Handles JavaScript and Rust debug adapters across platforms
- **Bundle Completeness**: Ensures all necessary adapters are included in distribution
- **Clean Build Process**: Always rebuilds from scratch for consistent output

### Runtime Coordination
- **Lazy Loading**: Main application loads only after proper initialization
- **Flag-Based Communication**: Prevents duplicate initialization across components
- **Graceful Degradation**: System continues functioning even with adapter failures

This module serves as the complete "front-to-back" solution for MCP debugger distribution, handling everything from TypeScript compilation to npm package creation to runtime protocol compliance, ensuring users get a fully functional debugging environment through a single `npx` command.