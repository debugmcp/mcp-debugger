# packages\adapter-javascript/
@children-hash: df18f8f8839ba716
@generated: 2026-02-15T09:02:09Z

## Overall Purpose and Responsibility

The `packages/adapter-javascript` directory implements a production-ready JavaScript and TypeScript debug adapter for the DebugMCP framework. This module wraps Microsoft's VS Code js-debug DAP server to provide intelligent, auto-configuring debug sessions for JavaScript/TypeScript applications. It handles complex environment detection, dependency management, and cross-platform compatibility while maintaining strict Debug Adapter Protocol (DAP) compliance.

## Key Components and Integration

### Core Debug Infrastructure (`src/`)
- **JavascriptDebugAdapter**: Main adapter implementation managing debugging sessions through complete DAP lifecycle (UNINITIALIZED → READY → DEBUGGING)
- **JavascriptAdapterFactory**: Environment validation and adapter instantiation with prerequisite checking (Node.js version, vendored dependencies)
- **Configuration Pipeline**: Sophisticated auto-detection system for ESM/CommonJS modules, TypeScript setups, and executable resolution

### Dependency Management (`scripts/`)
- **Vendor System**: Automated acquisition and building of VS Code's js-debug server through multiple strategies (local override, prebuilt download, source build)
- **Asset Intelligence**: GitHub release analysis with smart asset selection and cross-platform compatibility
- **Cache Management**: Idempotent execution with SHA256 verification and provenance tracking

### Quality Assurance (`tests/` + `vitest.config.ts`)
- **Comprehensive Test Suite**: Mock-based unit testing with cross-platform edge case coverage
- **High Coverage Standards**: 90% minimum coverage enforcement across all metrics
- **Environment Isolation**: Reproducible testing without external filesystem dependencies

## Public API Surface

### Primary Entry Points
```typescript
// Main adapter components
JavascriptAdapterFactory: Factory for creating debug adapter instances
JavascriptDebugAdapter: Core DAP-compliant debug adapter

// Configuration utilities  
resolveNodeExecutable(): Cross-platform Node.js path resolution
detectTsRunners(): TypeScript runtime detection (tsx, ts-node)
transformConfig(): Project analysis and configuration transformation

// Type definitions
JsDebugConfig: Configuration interface for debugging sessions
```

### Build/Deployment Entry Points
- `scripts/build-js-debug.js`: Main vendoring script for acquiring debug server dependencies
- Package exports through `src/index.ts` barrel pattern

## Internal Organization and Data Flow

### Initialization Flow
1. **Environment Validation**: Factory checks Node.js version compatibility and vendored dependency availability
2. **Runtime Detection**: Intelligent discovery of TypeScript runtimes and Node.js executables with local-first preference
3. **Project Analysis**: Automatic detection of ESM/CommonJS, TypeScript configurations, and output patterns
4. **Adapter Creation**: Factory instantiates configured adapter with environment-specific settings

### Debug Session Management
1. **Configuration Transform**: Auto-detection pipeline transforms user configurations based on project characteristics
2. **DAP Integration**: Wraps vendored VS Code js-debug server with standardized DebugMCP interface compliance
3. **State Management**: Maintains debugging state through complete session lifecycle with proper cleanup
4. **Transport Handling**: TCP-only communication for proxy infrastructure integration

### Dependency Acquisition
1. **Strategy Selection**: Environment-driven choice between local override, prebuilt download, or source compilation
2. **Asset Processing**: GitHub release analysis with intelligent asset selection and archive handling
3. **Vendor Integration**: CommonJS conversion, validation, and deterministic placement in `vendor/js-debug/`
4. **Cache Management**: SHA256-verified artifacts with force-rebuild capabilities

## Important Patterns and Conventions

### Cross-Platform Compatibility
- Platform-aware executable resolution with proper Windows extension handling (.exe, .cmd)
- Consistent path normalization and environment variable respect (MCP_CONTAINER, MCP_WORKSPACE_ROOT)
- Graceful Windows shell fallbacks for build operations

### Intelligent Configuration
- Zero-configuration debugging through automatic project type detection
- TypeScript path mapping support with source map handling
- ESM loader configuration with appropriate runtime selection

### Robust Error Handling
- No-throw filesystem operations throughout utility layers
- User-friendly error translation for common issues (missing dependencies, version mismatches)
- Comprehensive fallback chains with graceful degradation

### Performance Optimization
- Module-level caching for expensive operations (executable discovery, TypeScript runtime detection)
- Lazy evaluation patterns to minimize unnecessary work
- Synchronous operations where interface constraints require immediate results

This package serves as the definitive JavaScript/TypeScript debugging solution for DebugMCP, providing enterprise-grade reliability through sophisticated environment detection, comprehensive error handling, and strict protocol compliance while minimizing manual configuration requirements.