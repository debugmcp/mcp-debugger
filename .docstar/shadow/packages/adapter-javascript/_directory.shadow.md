# packages/adapter-javascript/
@generated: 2026-02-10T01:20:16Z

## Overall Purpose and Responsibility

The `packages/adapter-javascript` directory implements a comprehensive JavaScript/TypeScript debug adapter for the DebugMCP framework. This package provides intelligent debugging capabilities by wrapping VS Code's proven js-debug adapter with sophisticated environment detection, automatic configuration transformation, and seamless TypeScript runtime integration.

## Key Components and Integration

### Core Architecture
- **Source Implementation (`src/`)**: Contains the complete adapter implementation with factory pattern, debug session management, and intelligent configuration handling
- **Build Infrastructure (`scripts/`)**: Comprehensive vendoring system that acquires, builds, and installs Microsoft's js-debug DAP server through multiple strategies (prebuilt releases, source compilation, local overrides)
- **Test Suite (`tests/`)**: Extensive validation framework covering all debugging capabilities, platform behaviors, and edge cases
- **Configuration (`vitest.config.ts`)**: Test framework setup with high coverage standards and monorepo workspace support

### Component Integration Flow
```
Build Scripts → Vendor js-debug → Source Implementation → Test Validation → Production Package
```

The build system ensures js-debug availability before the adapter can function, while the source implementation provides the intelligent wrapper layer that transforms DebugMCP requests into js-debug compatible operations.

## Public API Surface

### Primary Entry Points
- **`JavascriptAdapterFactory`**: Main factory for creating validated adapter instances with environment requirement checks (Node.js ≥14, vendor dependencies, TypeScript runtimes)
- **`JavascriptDebugAdapter`**: Core debugging session manager implementing IDebugAdapter interface with DAP protocol handling
- **`JsDebugConfig`**: TypeScript interface defining flexible debugging configuration options

### Key Capabilities
- **Intelligent Configuration**: Automatic project type detection (ESM/CommonJS), TypeScript runtime selection (tsx, ts-node), and path resolution
- **Cross-Platform Support**: Handles Windows/Unix differences, executable discovery, and platform-specific behaviors
- **Runtime Integration**: Seamless TypeScript debugging with source map support and automatic configuration transformation
- **Environment Adaptation**: Local-first resolution, container support, and workspace environment handling

## Internal Organization and Data Flow

### Adapter Lifecycle
1. **Factory Validation**: Environment checks and dependency verification
2. **Configuration Intelligence**: Project analysis and automatic TypeScript detection
3. **Debug Session Management**: DAP protocol translation and state tracking
4. **Vendor Integration**: Communication with underlying js-debug adapter via TCP

### Build System Flow
1. **Strategy Determination**: Environment analysis to select acquisition method (local/prebuilt/source)
2. **Asset Acquisition**: GitHub API interaction, download, or local compilation
3. **Vendoring**: Installation to vendor directory with CommonJS boundaries and validation
4. **Validation**: Checksum verification and sidecar presence confirmation

## Important Patterns and Conventions

### Design Principles
- **Defensive Programming**: No-throw utilities with graceful fallbacks and comprehensive error handling
- **Intelligent Defaults**: Automatic detection with manual override capabilities
- **Dependency Isolation**: Vendored js-debug with controlled boundaries and deterministic output
- **Cross-Platform First**: Consistent behavior across development environments

### Quality Assurance
- **High Coverage Standards**: 90% minimum coverage across all metrics
- **Comprehensive Testing**: Unit tests covering all functional areas, platform behaviors, and edge cases
- **Mock Infrastructure**: Standardized filesystem abstraction and dependency injection for reliable testing
- **Integration Validation**: End-to-end workflow testing from configuration to debug session establishment

### Runtime Guarantees
- **Idempotent Operations**: Cache-aware execution with force-rebuild capability
- **Deterministic Output**: SHA256 checksums and provenance metadata
- **Offline Development**: Local override mechanisms for development workflows
- **Robust Error Handling**: User-friendly error messages with actionable guidance

This adapter serves as the critical bridge between DebugMCP's standardized debugging interface and the rich JavaScript/TypeScript debugging ecosystem, providing intelligent automation while maintaining the flexibility and power of VS Code's proven debugging infrastructure.