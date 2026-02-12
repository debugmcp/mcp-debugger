# packages\adapter-javascript/
@generated: 2026-02-12T21:01:34Z

## Overall Purpose and Responsibility

The `packages/adapter-javascript` directory implements a complete JavaScript/TypeScript debugging adapter for the DebugMCP framework. It serves as a bridge between the framework's standardized debugging interface and Microsoft's js-debug adapter, providing automatic runtime detection, configuration transformation, and cross-platform compatibility for Node.js and TypeScript debugging scenarios.

## Key Components and Relationships

### Core Architecture
- **JavascriptAdapterFactory**: Entry-point factory that validates the debugging environment (Node.js version, vendor dependencies, TypeScript runners) and creates adapter instances
- **JavascriptDebugAdapter**: Main adapter implementation managing debugging lifecycle, configuration transformation, and DAP (Debug Adapter Protocol) compliance
- **Vendored js-debug Integration**: Automated build pipeline that acquires, builds, and packages Microsoft's js-debug DAP server from multiple sources

### Supporting Infrastructure
- **Configuration Analysis Layer** (`src/utils/`): Intelligent project structure detection for ESM/CommonJS modules, TypeScript path mappings, and build output patterns
- **Cross-Platform Executable Resolution**: Multi-tier Node.js and TypeScript runtime discovery with fallback strategies
- **Build Automation** (`scripts/`): Complete vendoring pipeline for js-debug with GitHub API integration, source builds, and local overrides
- **Comprehensive Test Suite** (`tests/`): Unit tests covering DAP protocol compliance, configuration management, and cross-platform compatibility

## Public API Surface

### Primary Entry Points
- **JavascriptAdapterFactory**: Factory class for creating validated adapter instances with environment checks
- **JavascriptDebugAdapter**: Main debugging session manager implementing full DAP protocol
- **Configuration API**: `transformConfig()` for analyzing and transforming debugging configurations
- **Executable Resolution**: `resolveNodeExecutable()` and `detectTsRunners()` for runtime discovery

### Build and Development Tools
- **`scripts/build-js-debug.js`**: Primary vendoring script for js-debug dependency management
- **Environment Configuration**: Supports JS_DEBUG_* environment variables for build customization
- **Test Infrastructure**: Comprehensive test suite with cross-platform mocking and validation

## Internal Organization and Data Flow

### Debugging Lifecycle Flow
1. **Factory Validation**: Environment checks for Node.js version and vendor dependencies
2. **Adapter Initialization**: State management through defined transitions (UNINITIALIZED → READY → DEBUGGING)
3. **Configuration Transformation**: Project analysis and automatic TypeScript/ESM detection
4. **Runtime Resolution**: Cross-platform executable discovery with intelligent fallbacks
5. **DAP Communication**: Protocol handling with event emission and error translation

### Build and Dependency Management
1. **Vendor Strategy Determination**: Environment-driven selection of acquisition methods (local/prebuilt/source)
2. **Asset Acquisition**: GitHub API integration with retry logic and validation
3. **Build Processing**: Compilation and packaging of js-debug with standardized output structure
4. **Integration Validation**: Comprehensive testing across platforms and configurations

## Important Patterns and Conventions

### Architectural Principles
- **Graceful Degradation**: Safe defaults when detection fails, warnings instead of errors for non-critical issues
- **Cross-Platform Compatibility**: Windows/Unix executable handling and path normalization
- **Dependency Isolation**: Vendored critical dependencies with minimal external requirements
- **State-Driven Design**: Clear state transitions with event emission for lifecycle management

### Key Technical Constraints
- **TCP Transport Only**: Required for proxy infrastructure compatibility
- **Synchronous Configuration**: Interface limitations prevent async operations in config transformation
- **Container Support**: Handles MCP_CONTAINER and MCP_WORKSPACE_ROOT environment variables
- **High Test Coverage**: 90% coverage threshold enforced across all metrics

### Integration Context
This adapter serves as the complete JavaScript/TypeScript debugging solution within the DebugMCP ecosystem, providing robust runtime detection, configuration management, and debugging capabilities while maintaining compatibility with VS Code's proven js-debug adapter. It handles the complexity of modern JavaScript tooling (ESM, TypeScript, various runtimes) while presenting a unified debugging interface to the framework.