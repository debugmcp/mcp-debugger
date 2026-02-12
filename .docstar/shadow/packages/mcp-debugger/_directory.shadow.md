# packages\mcp-debugger/
@generated: 2026-02-12T21:06:01Z

## Overall Purpose and Responsibility

The `packages/mcp-debugger` module is a comprehensive CLI tool for debugging applications through the Model Context Protocol (MCP). It serves as a batteries-included debugging solution that provides multi-language debugging capabilities while maintaining strict MCP transport protocol compliance. The module combines sophisticated initialization orchestration, comprehensive debugging adapter bundling, and automated build pipeline management to deliver a self-contained debugging tool.

## Key Components and Integration

### Core Architecture
The module is organized into two primary subsystems that work in concert:

**Source Implementation (`src/`)**: 
- **cli-entry.ts**: Critical initialization orchestrator that ensures MCP protocol compliance through careful console management and dynamic loading
- **batteries-included.ts**: Static adapter bundling system that registers all available debugging adapters (JavaScript, Python, Mock) in the global scope

**Build Infrastructure (`scripts/`)**: 
- **bundle-cli.js**: Complete build pipeline that transforms source code into distributable artifacts with embedded debugging adapters and runtime dependencies

### Integration Flow
1. **Build Phase**: Scripts bundle the CLI with all debugging adapters and vendor payloads (js-debug, CodeLLDB)
2. **Initialization Phase**: CLI entry point detects transport mode and silences console output for MCP compliance
3. **Runtime Phase**: Adapters are dynamically loaded and made available through global registry for debugging sessions

## Public API Surface

### Primary Entry Points
- **CLI Executable**: Main entry point supports npx execution with automatic transport detection (stdio/SSE)
- **Adapter Registry**: Global `__DEBUG_MCP_BUNDLED_ADAPTERS__` provides runtime access to all bundled debugging adapters
- **Build Pipeline**: `bundleProxy()` and `bundleCLI()` functions for creating distribution artifacts

### Supported Debugging Languages
- **JavaScript/Node.js**: Full debugging support via js-debug adapter
- **Python**: Python runtime debugging capabilities
- **Rust**: CodeLLDB adapter for Rust debugging (platform-conditional)
- **Mock/Testing**: Simulation adapter for development scenarios

## Internal Organization and Data Flow

### Critical Initialization Sequence
The module implements a sophisticated bootstrap process that ensures MCP protocol compliance:
1. **Argument Processing**: Parse and normalize CLI arguments with flexible format support
2. **Transport Detection**: Analyze execution context to determine MCP transport mode
3. **Console Silencing**: Disable console output when stdio/SSE transport is active
4. **Dynamic Loading**: Import adapters and main logic after protocol state is secured
5. **Global Registration**: Make adapters discoverable through standardized registry pattern

### Build and Distribution Pipeline
- **Multi-Stage Bundling**: Separate builds for CLI core and DAP proxy components
- **Asset Management**: Intelligent copying of runtime dependencies and debugging adapters
- **Vendor Integration**: Platform-specific embedding of external debugging tools
- **Package Preparation**: Complete npm package generation with tarball creation

## Important Patterns and Conventions

### MCP Protocol Compliance Pattern
The module prioritizes transport protocol integrity above all else - console silencing occurs before any imports to prevent corruption of stdio-based MCP communication channels.

### Batteries-Included Philosophy
Static imports ensure comprehensive adapter bundling at build time while global registry patterns enable runtime discovery without explicit dependency injection.

### Self-Contained Distribution
The build system creates fully autonomous executables with embedded debugging adapters, eliminating external dependencies and simplifying deployment.

### Environment-Driven Configuration
Conditional vendor payload inclusion and platform-specific asset handling provide flexible distribution options while maintaining broad compatibility.

This module represents a complete debugging ecosystem that balances ease of use, protocol compliance, and comprehensive multi-language debugging support within the MCP framework.