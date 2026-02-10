# packages/mcp-debugger/src/
@generated: 2026-02-10T21:26:22Z

## Overall Purpose

This directory serves as the CLI distribution layer for the MCP debugger, providing the critical bridge between npm/npx execution and the core debugger functionality. It handles two essential responsibilities: ensuring all debugger adapters are properly bundled for distribution and managing console output to maintain MCP protocol compliance.

## Key Components and Integration

### Adapter Bundling System (`batteries-included.ts`)
- **Static Import Registry**: Forces esbuild to include all MCP debugger adapters (JavaScript, Python, Mock) in the CLI bundle
- **Global Registration Pattern**: Uses `__DEBUG_MCP_BUNDLED_ADAPTERS__` global namespace to make adapters discoverable across the application
- **Adapter Factory Management**: Maintains type-safe registry of `IAdapterFactory` implementations with language-based deduplication

### CLI Entry Point (`cli-entry.ts`)
- **Console Silencing Engine**: Critical pre-import logic that nullifies all console methods when using stdio/SSE transports to prevent MCP protocol corruption
- **Dynamic Bootstrap**: Lazy-loads the main application after console management and adapter registration
- **Transport Detection**: Intelligent detection of MCP transport modes (stdio, SSE) through argument parsing and environment analysis

## Public API Surface

### Primary Entry Point
- **`cli-entry.ts`**: Main executable entry point designed for npx usage
  - Handles command-line argument processing with quote stripping
  - Manages environment flag coordination (`CONSOLE_OUTPUT_SILENCED`, `DEBUG_MCP_SKIP_AUTO_START`)
  - Provides error handling that respects protocol requirements

### Adapter Discovery API
- **Global Adapter Registry**: Accessible via `globalThis.__DEBUG_MCP_BUNDLED_ADAPTERS__`
- **Bundled Adapters**: JavaScript, Python, and Mock adapters automatically available
- **Factory Pattern**: Each adapter exposed through standardized `IAdapterFactory` interface

## Internal Organization and Data Flow

1. **Initialization Sequence**:
   - Console silencing logic executes first (critical for protocol compliance)
   - Adapter bundling occurs through static imports
   - Global registration makes adapters discoverable
   - Main application bootstrap with coordinated flags

2. **Cross-Module Communication**:
   - Environment variables coordinate between CLI and main application
   - Global object pattern enables adapter discovery without explicit dependency injection
   - Flag-based coordination prevents duplicate initialization

## Important Patterns and Conventions

### Console Management Pattern
- **Pre-import Execution**: Console silencing MUST occur before any module imports
- **Conditional Restoration**: Error handling respects console silencing state
- **Transport Awareness**: Silencing decisions based on MCP transport mode detection

### Bundle Distribution Strategy
- **Static Import Forcing**: Ensures esbuild includes all adapters in final bundle
- **Side-Effect Modules**: Registration happens on import without explicit API calls
- **Global Discovery**: Adapters available system-wide through predictable global namespace

### Error Resilience
- **Graceful Degradation**: Failed adapter registration doesn't break the system
- **Protocol Compliance**: Error messages respect console silencing requirements
- **Development vs Production**: Conditional logging based on transport mode

This directory essentially acts as the "front door" for the MCP debugger CLI, ensuring proper bundling, protocol compliance, and seamless handoff to the core debugger implementation.