# tests/
@children-hash: eafe62d90a77fbcd
@generated: 2026-02-21T20:49:05Z

## Overall Purpose and Responsibility

The `tests` directory serves as the comprehensive test infrastructure for the Debug MCP Server ecosystem, providing validation coverage from unit tests through end-to-end integration across multiple programming languages, transport protocols, and deployment scenarios. This directory ensures the reliable operation of a sophisticated debugging system that bridges the Model Context Protocol (MCP) with language-specific debug adapters, enabling AI agents to perform debugging operations across JavaScript, TypeScript, Python, Rust, and Go codebases.

## Key Components and Integration Architecture

### Multi-Layer Testing Framework

The directory implements a hierarchical testing strategy with five primary validation layers:

**Foundation Layer (`core/`, `unit/`)**
- Protocol contract validation and debug adapter interface compliance
- Comprehensive unit testing of 19 MCP tools and core debugging operations
- Session management, factory patterns, and dependency injection testing
- Runtime type safety and API migration compliance validation

**Language Adapter Layer (`adapters/`)**
- Cross-platform validation of Go, JavaScript/TypeScript, Python, and Rust debug adapters
- Unified testing patterns for adapter factories, configuration processing, and command generation
- Integration testing with language-specific debugging backends (Delve, js-debug, debugpy, CodeLLDB)

**Transport and Protocol Layer (`proxy/`, `stress/`)**
- Debug Adapter Protocol (DAP) proxy system testing with multi-session debugging support
- Cross-transport parity validation (STDIO, SSE, Docker) under stress conditions
- Connection resilience, failure recovery, and performance validation

**Integration and E2E Layer (`integration/`, `e2e/`)**
- End-to-end workflow validation across all supported languages and deployment scenarios
- Docker containerization, npm distribution, and production deployment testing
- Complete debugging lifecycle validation from session creation through cleanup

**Infrastructure and Support Layer (`test-utils/`, `implementations/`, `fixtures/`)**
- Comprehensive mock infrastructure and test double implementations
- Multi-language debugging fixtures and controlled test environments
- Resource management, port allocation, and process lifecycle utilities

### Component Integration Flow

The testing architecture follows the production system's data flow:
1. **CLI Interface** → Transport handlers (STDIO/SSE) → MCP Server
2. **MCP Server** → Session Management → Debug Adapter Selection
3. **Debug Adapters** → Language-specific debugging backends → Target applications
4. **Communication Flow** → DAP Protocol → Proxy System → Multi-session coordination

## Public API Surface and Entry Points

### Primary Test Execution Points

**Language-Specific Testing**
- Adapter test suites for each supported language with factory validation and integration testing
- Language-specific E2E workflows with complete debugging lifecycle coverage
- Cross-platform compatibility testing with environment validation

**Protocol and Transport Testing**
- MCP tool validation across 19 core debugging operations
- DAP proxy system testing with multi-session debugging scenarios
- Transport parity validation (STDIO vs SSE) with stress testing capabilities

**Infrastructure Validation**
- Session management lifecycle testing with state persistence and cleanup
- Resource allocation testing with port management and process tracking
- Mock infrastructure validation enabling isolated unit testing

### Test Infrastructure APIs

**Resource Management**
- `portManager`, `processTracker` singletons for global test coordination
- `createTestDependencies()`, `createTestSessionManager()` factory functions
- Environment detection utilities for runtime availability validation

**Mock and Fixture Systems**
- Comprehensive mock factories for all system dependencies
- Multi-language debugging fixtures with predictable execution flows
- Test double implementations replacing real processes and network operations

## Internal Organization and Data Flow

### Testing Strategy Patterns

**Progressive Complexity Model**
- Unit tests → Integration tests → E2E tests → Stress tests
- Simple fixtures → Complex scenarios → Real-world applications
- Isolated mocks → Controlled environments → Production-like deployments

**Cross-Platform Validation**
- Consistent testing across Windows, Linux, and macOS environments
- Platform-specific toolchain detection and compatibility validation
- Container-based testing for deployment scenario verification

**Resource Management Architecture**
- Systematic test isolation preventing resource conflicts and pollution
- Automated cleanup patterns ensuring reliable test execution
- Memory leak detection and promise tracking across test sessions

### Quality Assurance Framework

**Error Resilience Testing**
- Comprehensive error path coverage with graceful degradation validation
- Timeout handling, connection failures, and resource exhaustion scenarios
- Mock-driven error injection for robust failure mode testing

**Performance and Scalability**
- Stress testing with rapid connections, burst traffic, and sustained operations
- Memory usage monitoring and performance threshold validation
- Cross-transport performance parity ensuring consistent user experience

## Framework Integration and Dependencies

### Core Testing Technologies
- **Vitest**: Primary testing framework with comprehensive mocking capabilities
- **Jest**: E2E test environment with TypeScript runtime support
- **MCP SDK**: Protocol communication libraries for integration testing
- **Docker**: Containerized testing environments for production scenario validation

### Language-Specific Integration
- **Debug Adapter Protocol**: Standardized debugging communication across all adapters
- **Language Toolchains**: Integration with Go, Rust, Python, and Node.js debugging ecosystems
- **Platform Services**: Process management, filesystem operations, and network communication

This comprehensive test directory ensures the Debug MCP Server provides reliable, cross-platform debugging capabilities while maintaining high code quality, robust error handling, and consistent performance across all supported programming languages and deployment scenarios. The extensive validation coverage serves as both quality assurance and living documentation of the system's capabilities and architectural contracts.