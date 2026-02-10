# packages/
@generated: 2026-02-10T01:21:13Z

## Overall Purpose and Responsibility

The `packages` directory contains the complete ecosystem for a multi-language Debug Adapter Protocol (DAP) compliant debugging framework. This modular system provides comprehensive debugging capabilities across six programming languages (Go, Java, JavaScript/TypeScript, Python, Rust, and mock environments) through a unified architecture that bridges modern IDE debugging interfaces with language-specific debugging tools. The packages collectively implement the MCP (Model Context Protocol) debugger system, offering both programmatic integration and standalone CLI distribution.

## Key Components and System Integration

### Language Adapter Ecosystem
The core of the system consists of six specialized debug adapters, each implementing language-specific debugging capabilities while adhering to common architectural patterns:

- **adapter-go**: Integrates with Delve debugger for native Go debugging with goroutine management
- **adapter-java**: Bridges DAP with command-line JDB through TCP proxy architecture  
- **adapter-javascript**: Wraps VS Code's js-debug with intelligent TypeScript runtime detection
- **adapter-python**: Connects to Python's debugpy infrastructure with cross-platform environment handling
- **adapter-rust**: Orchestrates Cargo builds with CodeLLDB debugging integration
- **adapter-mock**: Provides comprehensive testing infrastructure and reference implementation

### Foundational Infrastructure
- **shared**: Core library providing common abstractions, interfaces, policy-based customization, and infrastructure for all language adapters
- **mcp-debugger**: Standalone CLI distribution package that bundles all adapters into a deployable tool

### Architectural Integration Flow

```
CLI Distribution → Adapter Registry → Language-Specific Adapters → Shared Infrastructure → External Debug Tools
```

1. **Shared Foundation**: Provides common interfaces (`IDebugAdapter`, `IAdapterFactory`), state management, policy framework, and DAP protocol abstractions
2. **Language Adapters**: Implement language-specific debugging by integrating with native tools (Delve, JDB, js-debug, debugpy, CodeLLDB)
3. **Adapter Registry**: Enables dynamic discovery and instantiation of appropriate adapters based on project context
4. **CLI Distribution**: Packages everything into a standalone, protocol-compliant tool for easy deployment

## Public API Surface

### Primary Entry Points

**Language Adapter Factories**: Each adapter exports a factory implementing `IAdapterFactory`:
- `GoAdapterFactory`, `JavaAdapterFactory`, `JavascriptAdapterFactory`, `PythonAdapterFactory`, `RustAdapterFactory`, `MockAdapterFactory`

**Shared Infrastructure**: 
- `IDebugAdapter`: Universal debug adapter interface
- `IAdapterRegistry`: Central registry for adapter management
- `AdapterPolicy`: Strategy pattern for language-specific customization
- Enhanced DAP types with custom launch/attach configurations

**CLI Tool**: 
- `@debugmcp/debugger`: npm-installable standalone debugger with MCP protocol compliance

### Core Capabilities Across All Adapters

**Environment Management**: Cross-platform toolchain discovery, validation, and intelligent caching
**Configuration Intelligence**: Automatic project detection, build orchestration, and runtime selection
**Debug Session Management**: Complete DAP lifecycle with state machine management and event emission
**Protocol Translation**: Seamless bridging between modern DAP clients and various debugging backends

## Internal Organization and Data Flow

### Modular Architecture Pattern
Each language adapter follows consistent architectural patterns:
- **Factory Layer**: Environment validation and adapter instantiation
- **Adapter Layer**: Debug session lifecycle and DAP protocol handling  
- **Utils Layer**: Language-specific toolchain integration and platform compatibility
- **Testing Layer**: Comprehensive validation with mock infrastructure

### Cross-Platform Integration Strategy
- **Environment Discovery**: Multi-strategy executable resolution with platform-specific optimizations
- **Build System Integration**: Language-aware project discovery and build orchestration
- **Protocol Abstraction**: Unified DAP interface hiding language-specific debugging complexity
- **Dependency Management**: Automated vendoring of required debugging tools and runtime dependencies

### Quality Assurance Framework
- **Comprehensive Testing**: High coverage standards (90%+) across all packages with integration validation
- **Mock Infrastructure**: Sophisticated testing utilities enabling isolated validation without external dependencies  
- **Cross-Platform Validation**: Consistent behavior across Windows, macOS, and Linux development environments
- **Error Resilience**: Graceful degradation, detailed diagnostics, and user-friendly error reporting

## Important Patterns and Conventions

### Factory Pattern with Dependency Injection
Consistent adapter creation through factories that encapsulate environment validation, dependency injection, and configuration management while maintaining clean separation of concerns.

### Policy-Driven Customization
Language-specific behaviors implemented through the strategy pattern, enabling specialized handling (goroutine filtering for Go, virtual environment detection for Python) without modifying core infrastructure.

### Protocol-First Design
DAP compliance prioritized throughout the system with careful transport management, initialization ordering, and state machine enforcement ensuring reliable integration with modern development tools.

### Performance Optimization
Strategic caching of environment discovery, intelligent build detection, and asynchronous operation management providing responsive debugging experiences across all supported languages.

This packages directory represents a complete, production-ready debugging ecosystem that transforms diverse language-specific debugging tools into a unified, modern debugging experience while maintaining the power and flexibility of each language's native debugging capabilities.