# packages\adapter-javascript/
@children-hash: 4c14b4706188d1a3
@generated: 2026-02-24T01:54:59Z

## Overall Purpose and Responsibility

This package provides a complete JavaScript/TypeScript debug adapter implementation for the MCP debugger ecosystem. It serves as a bridge between the Debug Adapter Protocol (DAP) and Microsoft's `vscode-js-debug` adapter, offering intelligent project detection, runtime resolution, and debugging session management specifically tailored for JavaScript and TypeScript applications.

## Key Components and Integration

### Core Adapter Architecture (`src/`)
The heart of the package is the **JavascriptDebugAdapter** class, which implements the DAP specification while wrapping Microsoft's js-debug adapter. This is complemented by:

- **JavascriptAdapterFactory**: Handles environment validation (Node.js ≥14, TypeScript tooling) and adapter instantiation
- **Configuration System**: Intelligent detection of project types (ESM vs CommonJS, TypeScript projects) with automatic configuration transformation
- **Runtime Resolution**: Cross-platform executable discovery for Node.js, tsx, and ts-node with intelligent fallback mechanisms

### Dependency Management (`scripts/`)
A sophisticated vendoring system that automatically acquires and builds Microsoft's js-debug adapter:

- **Multi-strategy acquisition**: Local override, prebuilt downloads, source compilation, and hybrid modes
- **GitHub integration**: Intelligent asset selection from releases with platform-specific optimization
- **Build orchestration**: Handles CommonJS conversion, dependency installation, and artifact validation
- **Environment-driven configuration**: Flexible deployment strategies based on CI/CD requirements

### Testing Infrastructure (`tests/`)
Comprehensive unit test suite with mock-based isolation, cross-platform awareness, and edge case coverage ensuring robust DAP compliance and error handling.

## Public API Surface

### Primary Entry Points
- **`@debugmcp/adapter-javascript`**: Main package export providing the JavascriptAdapterFactory
- **JavascriptDebugAdapter**: Complete DAP-compliant debug adapter with JavaScript/TypeScript specializations
- **Configuration utilities**: Project detection and transformation functions for debugging setup

### Key Capabilities
- **Automatic Environment Detection**: Discovers Node.js installations, TypeScript tooling, and project configurations
- **TypeScript Support**: Seamless debugging of TypeScript code with source map integration and compilation handling
- **ESM/CommonJS Compatibility**: Intelligent project type detection with appropriate configuration adaptation
- **Multi-Runtime Support**: Works with standard Node.js, tsx, and ts-node execution environments

## Internal Organization and Data Flow

### Initialization Phase
1. **Environment Validation**: Factory checks Node.js version, js-debug availability, and TypeScript tooling
2. **Project Analysis**: Utils scan for package.json, tsconfig.json, and detect project characteristics
3. **Runtime Resolution**: Intelligent selection of appropriate JavaScript/TypeScript execution environment
4. **Adapter Instantiation**: Factory creates configured adapter instance with proper dependency injection

### Debugging Session Lifecycle
1. **Vendor Preparation**: Scripts ensure js-debug adapter is available and properly configured
2. **Connection Setup**: Adapter launches js-debug in TCP mode and establishes proxy connections
3. **Configuration Transformation**: Dynamic adaptation of launch configs based on detected project type
4. **DAP Protocol Handling**: Full-featured debugging with breakpoints, stepping, variable inspection, and state management

## Important Patterns and Conventions

### Design Principles
- **Intelligent Defaults**: Minimizes manual configuration through comprehensive auto-detection
- **Cross-Platform Compatibility**: Handles Windows/POSIX differences in executables and paths
- **Defensive Programming**: Robust error handling with graceful fallbacks for missing dependencies
- **Factory Pattern**: Clean separation between environment validation and adapter instantiation

### Build and Distribution
- **ES Module Architecture**: Modern JavaScript module system with TypeScript declaration support
- **Workspace Integration**: Seamless integration with the broader MCP debugger monorepo structure
- **Vendor Bundling**: Self-contained distribution including all necessary debug server dependencies
- **High Test Coverage**: Enforced 90% coverage standards with comprehensive edge case testing

This package represents a production-ready JavaScript/TypeScript debugging solution that abstracts away the complexity of environment configuration while providing robust debugging capabilities through the standardized Debug Adapter Protocol interface.