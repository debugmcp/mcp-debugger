# packages\mcp-debugger/
@generated: 2026-02-12T21:01:12Z

## Overall Purpose and Responsibility

The `packages/mcp-debugger` directory is a complete MCP (Model Context Protocol) debugger CLI package that provides multi-language debugging capabilities through a protocol-compliant interface. This module serves as both the implementation and distribution layer for a standalone debugging tool that integrates with MCP transports while supporting JavaScript, Python, and other language debugging adapters.

## Key Components and Integration

### Build Infrastructure (`scripts/`)
- **bundle-cli.js**: Primary build orchestrator that creates distributable CLI bundles, DAP proxy components, and integrates vendor debugging adapters (js-debug, CodeLLDB)
- Handles cross-platform packaging and npm distribution preparation
- Manages complex asset copying from monorepo shared resources

### Core Implementation (`src/`)
- **cli-entry.ts**: Main CLI entry point with protocol-compliant console handling and transport detection
- **batteries-included.ts**: Adapter bundle registry that ensures all debugging adapters are included in distribution
- Provides side-effect based adapter registration and global discovery mechanisms

### Architecture Integration
The components work together in a coordinated build-to-runtime pipeline:
1. **Build Phase**: Scripts bundle all components, copy shared assets, and create distributable packages
2. **Runtime Phase**: Source code orchestrates adapter discovery, protocol compliance, and CLI bootstrapping
3. **Distribution**: Results in a self-contained CLI tool with embedded multi-language debugging support

## Public API Surface

### Primary Entry Points
- **CLI Distribution**: Distributed as npm package with `cli-entry.ts` as main entry point
- **npx Compatibility**: Direct execution via `npx @modelcontextprotocol/debugger`
- **MCP Transport Support**: Handles stdio, SSE, and direct invocation modes

### Key Functions
- `bundleProxy()` / `bundleCLI()`: Build-time bundling operations
- Global adapter registry: `__DEBUG_MCP_BUNDLED_ADAPTERS__` for runtime adapter discovery
- Protocol-safe console management for MCP compliance

## Internal Organization and Data Flow

### Build-to-Runtime Pipeline
1. **Asset Aggregation**: Build scripts collect shared runtime assets and vendor dependencies
2. **Bundle Creation**: Creates optimized ESM/CommonJS compatible bundles
3. **Adapter Registration**: Language adapters self-register through module import side effects
4. **CLI Bootstrap**: Entry point coordinates initialization with protocol-aware console handling

### Multi-Language Support
- **JavaScript**: js-debug adapter integration
- **Rust**: CodeLLDB with platform-specific handling
- **Python/Mock**: Additional adapter support through extensible registry pattern
- **Vendor Management**: Environment-driven platform selection and graceful degradation

## Important Patterns and Conventions

### Protocol-First Design
- Critical console silencing for MCP transport compatibility
- Environment flag coordination (`CONSOLE_OUTPUT_SILENCED`, `DEBUG_MCP_SKIP_AUTO_START`)
- Transport detection and protocol-appropriate error handling

### Distribution Architecture
- Self-contained packaging with all dependencies bundled
- Cross-platform support with platform-aware vendor handling
- ESM-first approach with CommonJS compatibility
- Node.js 18+ targeting with comprehensive dependency bundling

### Extensibility Patterns
- Global registry pattern for adapter discovery
- Factory-based adapter instantiation
- Side-effect registration for clean module loading
- Dynamic import strategy for controlled initialization sequences

This package enables developers to easily debug multi-language applications through MCP protocols while maintaining the flexibility to work in various transport modes and deployment environments.