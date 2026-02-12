# packages\adapter-javascript/
@generated: 2026-02-12T21:06:29Z

## Overall Purpose and Responsibility

The `packages/adapter-javascript` directory implements a production-ready JavaScript/TypeScript debug adapter for the DebugMCP framework. This module provides a complete debugging solution that wraps Microsoft's js-debug adapter (VS Code's JavaScript debugger) in a standardized interface, enabling intelligent project detection, configuration transformation, and lifecycle management for JavaScript and TypeScript debugging sessions across different runtime environments.

## Key Components and Integration

### Core Architecture Layers

**Public Interface Layer (`src/index.ts`)**
- Barrel module providing clean re-exports of all public components
- Single entry point for external consumers

**Factory and Adapter Layer**
- **`JavascriptAdapterFactory`**: Environment validation and adapter instantiation with comprehensive dependency checking
- **`JavascriptDebugAdapter`**: Main orchestrator implementing IDebugAdapter interface, managing DAP protocol communication, state transitions, and configuration intelligence

**Infrastructure Layer (`src/utils/`)**
- Cross-platform executable resolution (Node.js, TypeScript runtimes)
- Project analysis and configuration transformation
- Environment detection and runtime coordination

**Vendoring System (`scripts/`)**
- Complete dependency management for js-debug server acquisition
- Multiple acquisition strategies: local development, prebuilt releases, source compilation
- Cross-platform build automation with intelligent fallback mechanisms

**Type System (`src/types/`)**
- Flexible configuration contracts and type definitions
- Integration specifications for the broader DebugMCP ecosystem

### Component Integration Flow

The components form a sophisticated pipeline where the vendoring system ensures dependencies are available, the factory validates the complete environment and creates adapter instances, the adapter orchestrates debugging sessions using utilities for intelligent project detection, while the type system provides contracts that enable seamless integration with the DebugMCP framework.

## Public API Surface

### Main Entry Points

**Primary Factory**
- `JavascriptAdapterFactory` - Entry point for creating validated adapter instances with comprehensive environment checks

**Core Adapter**
- `JavascriptDebugAdapter` - Main debugging session manager implementing standardized IDebugAdapter interface

**Configuration Types**
- `JsDebugConfig` - Flexible configuration interface supporting launch/attach scenarios
- Type definitions for adapter metadata and environment specifications

### Key Capabilities

**Environment Intelligence**
- Automatic TypeScript project detection with tsconfig.json analysis
- ESM vs CommonJS module system detection
- Runtime discovery (tsx, ts-node) with intelligent precedence rules
- Cross-platform Node.js executable resolution

**Configuration Transformation**
- Intelligent transformation of generic debug configs to js-debug-specific formats
- Automatic source map configuration and output file detection
- Smart defaults for different project structures and runtime environments

**Dependency Management**
- Automated js-debug server vendoring with multiple acquisition strategies
- GitHub release integration with intelligent asset selection
- Local development overrides and source compilation fallbacks

## Internal Organization and Data Flow

### Validation → Creation → Execution Pipeline

1. **Environment Validation**: Factory performs comprehensive checks for Node.js version, vendor dependencies, TypeScript tooling availability
2. **Adapter Instantiation**: Creates configured adapter instances with validated dependencies and project metadata
3. **Session Orchestration**: Manages complete debugging lifecycle with state tracking (UNINITIALIZED → READY → DEBUGGING)
4. **Configuration Intelligence**: Analyzes project structure and transforms configurations with appropriate runtime settings
5. **DAP Communication**: Handles Debug Adapter Protocol messages with proper event routing and error handling

### Dependency Acquisition Flow

1. **Strategy Determination**: Environment analysis determines optimal vendoring approach
2. **Asset Resolution**: Intelligent selection from GitHub releases or local development paths  
3. **Server Deployment**: Extraction, validation, and CommonJS boundary enforcement
4. **Runtime Integration**: DAP server discovery with multi-strategy fallback chains

## Important Patterns and Conventions

### Defensive Programming
- No-throw filesystem operations with graceful degradation
- Comprehensive error handling with user-friendly error translation
- Multiple fallback strategies for all critical operations
- Timeout mechanisms preventing blocking operations

### Cross-Platform Compatibility
- Platform-aware executable resolution (Windows .exe/.cmd, Unix binaries)
- Container environment support (MCP_CONTAINER, MCP_WORKSPACE_ROOT)
- Normalized path handling across different filesystems

### Production Readiness
- **High Test Coverage**: Enforces 90% coverage across all metrics with comprehensive test suite
- **Error Resilience**: Exponential backoff, retry logic, and graceful failure handling
- **Performance Optimization**: Caching layers for expensive detection operations
- **Dependency Reliability**: Multiple acquisition strategies ensure consistent availability

### Integration Architecture
- **Proxy Infrastructure Support**: TCP-only transport mode for MCP proxy architecture
- **Event-Driven Communication**: Standardized adapter interface with ProxyManager integration
- **Modular Design**: Clean separation of concerns enabling comprehensive testing and maintenance

This adapter serves as a complete, production-ready debugging solution that intelligently adapts to diverse JavaScript/TypeScript development environments while maintaining seamless compatibility with the broader DebugMCP ecosystem through standardized interfaces, robust error handling, and comprehensive dependency management.