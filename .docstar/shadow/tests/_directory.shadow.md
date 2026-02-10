# tests/
@generated: 2026-02-10T21:28:26Z

## Overall Purpose and Responsibility

The `tests` directory serves as the comprehensive testing infrastructure for the DebugMCP (Model Context Protocol) debugging system. This multi-layered test suite validates the complete debugging ecosystem from MCP protocol handling through language-specific adapter implementations, ensuring reliable AI-driven debugging capabilities across Python, JavaScript/TypeScript, Go, Rust, and Java programming environments.

## Key Components and Integration Architecture

The testing infrastructure is organized into specialized subdirectories that work together to provide comprehensive validation coverage:

### Core Testing Layers

**Unit Testing Foundation (`unit/`)**
- Complete unit test coverage for all core components including MCP server functionality, debug adapters, session management, proxy orchestration, and CLI interfaces
- Validates Debug Adapter Protocol (DAP) compliance, type safety, and protocol communication across all supported languages
- Provides isolated component testing with comprehensive mock frameworks and dependency injection

**End-to-End Validation (`e2e/`)**
- Production-ready workflow testing across all supported programming languages
- Validates complete debugging sessions from MCP client connection through debug target execution and state inspection
- Tests multiple transport mechanisms (stdio, SSE) and distribution methods (npm, Docker)

**Integration Testing (`integration/`, `adapters/`)**
- Language-specific adapter testing ensuring proper toolchain integration and cross-platform compatibility
- Validates real-world debugging scenarios with actual language runtimes and debugging tools
- Cross-platform testing across Windows, Linux, and macOS environments

### Specialized Testing Infrastructure

**Test Utilities and Support (`test-utils/`)**
- Centralized testing infrastructure providing mock factories, resource management, and test isolation utilities
- Promise leak detection, session management, and comprehensive cleanup mechanisms
- Shared fixtures and helpers enabling consistent testing patterns across all test suites

**Stress and Performance Testing (`stress/`, `proxy/`)**
- Transport layer reliability testing under extreme conditions and high load scenarios
- Cross-transport parity validation ensuring consistent behavior across stdio, SSE, and Docker transports
- Multi-session debugging validation and proxy system performance testing

**Manual and Validation Testing (`manual/`, `validation/`)**
- Developer-focused interactive testing tools for protocol validation and debugging
- Systematic breakpoint message validation and debugger behavior testing
- SSE connection testing and debugpy adapter integration validation

## Public API Surface and Entry Points

### Primary Test Execution Interfaces

**Automated Test Suites**
- **Vitest Integration**: All automated tests execute through Vitest framework with comprehensive async support and mock capabilities
- **Environment-Specific Testing**: Language toolchain detection and graceful degradation when dependencies are unavailable
- **Cross-Platform Execution**: Windows, Linux, and macOS compatibility with platform-specific path and process handling

**Test Configuration and Setup**
- **Global Setup**: `vitest.setup.ts` provides test environment initialization, mock configuration, and resource management
- **Jest Integration**: `jest-register.js` enables TypeScript runtime compilation for specialized test scenarios
- **Environment Variables**: Feature flags, timeout scaling, and debugging controls for CI/CD integration

### Core Testing Entry Points

**Language-Specific Validation**
- Complete debugging workflow testing for Python, JavaScript/TypeScript, Go, Rust, and Java
- Adapter factory validation, lifecycle management, and DAP protocol compliance testing
- Cross-platform executable discovery and environment validation

**Transport and Protocol Testing**
- MCP protocol implementation testing with all 19 debugging tools
- STDIO and SSE transport validation with real server connections
- Session management, authentication, and bidirectional communication testing

**System Integration Testing**
- Docker containerization testing and npm package distribution validation
- Process management, resource cleanup, and graceful error handling
- Memory leak detection and performance monitoring under load conditions

## Internal Organization and Testing Methodology

### Layered Testing Strategy

The test architecture follows a "Foundation First" approach that validates core functionality before testing complex integrations:

1. **Unit Layer**: Type safety, protocol compliance, and component isolation with comprehensive mocking
2. **Integration Layer**: Language adapter integration with real or sophisticated mock implementations  
3. **System Layer**: End-to-end workflows with production-like environments and real transport mechanisms
4. **Stress Layer**: Performance validation, load testing, and reliability under adverse conditions

### Quality Assurance Framework

**Test Isolation and Resource Management**
- Comprehensive environment setup/teardown preventing cross-test contamination
- Port allocation management avoiding conflicts in concurrent test execution
- Process lifecycle tracking with automatic cleanup and orphan prevention

**Mock and Dependency Strategy**
- **Unit Tests**: Complete dependency mocking for isolated component validation
- **Integration Tests**: Realistic implementations or sophisticated mocks for workflow testing  
- **E2E Tests**: Real implementations with external process spawning and actual toolchain integration

**Cross-Platform Compatibility**
- Platform-specific executable resolution and path handling across Windows/Unix systems
- Environment variable management with proper isolation and cleanup
- Container-aware functionality testing for Docker deployment scenarios

## System Validation Scope and Integration Role

This comprehensive test directory serves as the quality assurance foundation for the entire DebugMCP ecosystem, ensuring that AI agents can reliably create, manage, and interact with debugging sessions across multiple programming languages. The test infrastructure validates:

- **Protocol Compliance**: Complete MCP and DAP specification adherence across all debugging operations
- **Language Support**: Reliable debugging capabilities for Python, JavaScript/TypeScript, Go, Rust, and Java
- **Transport Reliability**: Consistent behavior across stdio, SSE, and Docker transport mechanisms
- **Cross-Platform Compatibility**: Dependable operation across Windows, Linux, and macOS environments
- **Production Readiness**: Performance, reliability, and error handling suitable for production deployment

The multi-layered testing approach provides confidence that the DebugMCP system delivers consistent, reliable debugging capabilities while maintaining type safety, protocol compliance, and robust error handling throughout the complete debugging lifecycle.