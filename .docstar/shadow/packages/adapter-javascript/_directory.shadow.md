# packages/adapter-javascript/
@generated: 2026-02-10T21:27:15Z

## Overall Purpose and Responsibility

The `packages/adapter-javascript` directory implements a complete JavaScript/TypeScript debug adapter for the DebugMCP framework. This module serves as a bridge between VS Code's vendored js-debug adapter and the standardized DebugMCP interface, providing comprehensive debugging capabilities for Node.js applications with intelligent TypeScript runtime detection and configuration transformation.

## Key Components and Architecture

### Core Debug Adapter System (`src/`)
- **JavascriptDebugAdapter**: Main adapter class that wraps VS Code's js-debug, managing DAP protocol communication, state transitions, and launch configuration transformation
- **JavascriptAdapterFactory**: Factory implementation providing environment validation, dependency checking, and adapter instantiation with metadata configuration
- **Configuration & Runtime Detection**: Comprehensive utilities for ESM project detection, TypeScript path analysis, executable resolution, and launch coordination

### Build Infrastructure (`scripts/`)
- **js-debug Vendoring System**: Sophisticated build pipeline that acquires, builds, and deploys Microsoft's js-debug DAP server
- **Multi-Strategy Acquisition**: Supports local development, prebuilt GitHub releases, source compilation, and hybrid approaches
- **Asset Management**: Handles version resolution, dependency validation, and cross-platform distribution

### Quality Assurance (`tests/`)
- **Comprehensive Test Suite**: Unit tests covering adapter functionality, configuration detection, runtime resolution, and cross-platform compatibility
- **Multi-Environment Validation**: Tests for various Node.js runtimes, TypeScript configurations, and platform-specific behaviors
- **Mock Infrastructure**: Isolated testing with filesystem abstraction and environment manipulation

### Development Configuration
- **Vitest Test Framework**: Configured for Node.js environment with 90% coverage enforcement and TypeScript-first development
- **Monorepo Integration**: Workspace aliases and shared package dependencies

## Public API Surface

### Main Entry Points
- **JavascriptAdapterFactory**: Primary factory for creating JavaScript debug adapter instances
- **JavascriptDebugAdapter**: Core IDebugAdapter implementation for debug session management
- **JsDebugConfig**: TypeScript configuration interface for launch parameters

### Key Capabilities
- **Multi-Runtime Support**: Automatic detection and configuration for Node.js, tsx, ts-node
- **TypeScript Integration**: Intelligent runtime selection, source mapping, and ESM project handling
- **Cross-Platform Operation**: Windows and POSIX executable resolution with container support
- **Configuration Transformation**: Automatic TypeScript detection with fallback strategies

### Environment Configuration
- **Build Control**: `JS_DEBUG_VERSION`, `JS_DEBUG_FORCE_REBUILD`, `JS_DEBUG_LOCAL_PATH` environment variables
- **Container Support**: `MCP_CONTAINER`, `MCP_WORKSPACE_ROOT` for proxy infrastructure compatibility
- **Authentication**: `GH_TOKEN` for GitHub API rate limit handling

## Internal Organization and Data Flow

### Component Integration Flow
1. **Build Phase**: Scripts acquire and vendor js-debug assets with comprehensive validation
2. **Initialization**: Factory validates Node.js environment, vendor files, and TypeScript tooling
3. **Project Analysis**: Utilities detect project characteristics, runtime requirements, and configuration needs
4. **Session Management**: Adapter handles DAP communication, launch coordination, and state transitions

### Layered Architecture
- **Factory Layer**: Environment validation and adapter instantiation
- **Adapter Layer**: DAP protocol handling and lifecycle management
- **Utilities Layer**: Configuration detection, executable resolution, and launch coordination
- **Vendor Layer**: js-debug DAP server integration and asset management

### Error Handling Strategy
- **Build Resilience**: Exponential backoff, cross-platform compatibility, and actionable error messages
- **Runtime Graceful Degradation**: Fallback strategies for missing dependencies with installation guidance
- **Validation Boundaries**: Clear distinction between critical errors and warnings

## Important Patterns and Conventions

### Development Workflow Support
- **Local Development**: Direct file copying for rapid iteration cycles
- **Production Deployment**: GitHub release acquisition with version pinning and provenance tracking
- **Hybrid Development**: Source building with package manager auto-detection

### Performance Optimization
- **Caching Strategy**: Module-wide caching for expensive operations (executable paths, project analysis)
- **Idempotent Operations**: Cache-aware execution with force-rebuild overrides
- **Lazy Loading**: On-demand dependency resolution and configuration transformation

### Platform Abstraction
- **Cross-Platform Compatibility**: Unified APIs with platform-specific implementations
- **Container Awareness**: Environment detection for proxy and container deployments
- **Transport Constraints**: TCP-only communication for infrastructure compatibility

This directory serves as a production-ready JavaScript/TypeScript debugging solution that seamlessly integrates Microsoft's powerful js-debug adapter with the DebugMCP framework, providing developers with reliable debugging capabilities across diverse project configurations and deployment environments.