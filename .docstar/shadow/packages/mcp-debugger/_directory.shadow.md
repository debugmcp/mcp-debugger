# packages/mcp-debugger/
@generated: 2026-02-09T18:16:22Z

## Overall Purpose & Responsibility

The `packages/mcp-debugger` directory contains a comprehensive, distributable CLI debugging tool for the Model Context Protocol (MCP) ecosystem. This module serves as a batteries-included debugger that provides multi-language debugging capabilities through a unified command-line interface, specifically designed for MCP transport protocol compatibility.

## Key Components & Architecture

### Build Distribution System (`scripts/`)
The build system orchestrates the creation of production-ready, self-contained debugger distributions. It handles JavaScript bundling, runtime asset management, and platform-specific vendor integration (js-debug, CodeLLDB) to produce npm-distributable packages with all necessary dependencies included.

### CLI Runtime System (`src/`)
The runtime system provides the executable entry point and adapter bootstrap infrastructure. It implements intelligent MCP protocol compatibility through transport-aware console management and maintains a global registry of supported language adapters.

### Component Integration Flow
1. **Build Time**: Scripts bundle all source code, copy runtime assets, and include platform-specific debugger binaries
2. **Runtime Bootstrap**: CLI entry detects execution context and silences output for MCP compatibility
3. **Adapter Registration**: All supported language adapters are registered in global registry
4. **Core Delegation**: Execution is handed off to the main debugger implementation

## Public API Surface

### Primary Entry Points
- **CLI Executable**: `cli-entry.ts` serves as the main command-line interface (npx compatible)
- **Distribution Bundles**: Build system produces both development mirrors and npm tarballs
- **Global Adapter Registry**: Centralized access to all bundled language debugging adapters

### Supported Debugging Capabilities
- **JavaScript/Node.js**: Full debugging support via integrated js-debug
- **Python**: Python-specific debugging capabilities  
- **Mock/Testing**: Development and testing adapter for validation
- **Multi-Platform**: Platform-aware binary inclusion for different execution environments

## Internal Organization & Data Flow

### MCP Protocol Integration
The entire system is designed around MCP transport compatibility:
- **Transport Detection**: Automatic identification of `stdio` and `sse` transport modes
- **Output Management**: Intelligent console silencing to prevent stdout pollution during MCP communication
- **Environment Coordination**: Uses environment variables to synchronize behavior between CLI and core systems

### Distribution Architecture
- **Self-Contained**: All runtime dependencies and debugger binaries included in distribution
- **Platform-Aware**: Conditional inclusion of platform-specific debugging tools
- **Graceful Degradation**: Missing vendor components generate warnings but don't prevent operation

### Adapter System
- **Factory Pattern**: All adapters implement consistent `IAdapterFactory` interface
- **Global Registry**: Singleton pattern using `globalThis` for centralized adapter management
- **Static Bundling**: esbuild-enforced static imports ensure all adapters are included in distribution

## Important Patterns & Conventions

### Early Initialization Strategy
Critical initialization occurs before module imports to ensure MCP protocol compatibility is established before any console output. This includes transport detection, console silencing setup, and environment variable coordination.

### Build-Time Asset Management
The build system follows a comprehensive asset inclusion strategy, systematically copying runtime directories, handling vendor binaries with platform awareness, and creating dual output formats for both development and production use.

### Error Handling & Compatibility
Implements dual-level error handling that respects console silencing requirements while maintaining proper exit codes and error visibility when appropriate, always prioritizing MCP protocol preservation over debug output.

This module enables seamless debugging capabilities within MCP-based applications while providing a familiar CLI experience for developers, bridging the gap between traditional debugging workflows and modern protocol-based AI systems.