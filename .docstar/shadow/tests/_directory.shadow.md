# tests/
@children-hash: a159187179e8b1ec
@generated: 2026-02-23T15:27:26Z

## Overall Purpose and Responsibility

The `tests` directory serves as the comprehensive testing infrastructure for the Debug MCP (Model Context Protocol) Server, providing complete validation coverage across unit tests, integration tests, end-to-end scenarios, stress testing, and manual validation utilities. This directory ensures the reliability, performance, and correctness of multi-language debugging capabilities through sophisticated testing patterns, mock infrastructures, and real-world scenario validation.

## Key Components and Integration Architecture

### Multi-Layer Testing Strategy

The directory implements a **five-tier testing architecture** that provides comprehensive coverage from individual components to full system integration:

**1. Unit Testing Foundation (`unit/`)**
- Core component testing with extensive mocking and dependency injection
- Protocol compliance validation (Debug Adapter Protocol, MCP tools)
- Error path coverage and edge case handling
- Language adapter testing across Python, JavaScript, Rust, Go, and Mock adapters

**2. Integration Testing Layer (`integration/`)**
- End-to-end debugging workflows with production dependencies
- Language-specific adapter integration with real debugging backends
- Session lifecycle and state persistence validation
- Cross-component interaction testing

**3. End-to-End Validation (`e2e/`)**
- Complete debugging scenarios across multiple transport mechanisms (STDIO, SSE)
- Docker containerization and NPM distribution testing
- Multi-language debugging matrix validation (19 MCP tools × 5 languages)
- Real-world deployment scenario testing

**4. Stress and Performance Testing (`stress/`)**
- Transport layer reliability under extreme conditions
- Cross-transport parity validation
- Connection pooling and server recovery testing
- Memory usage and performance characteristics validation

**5. Specialized Testing Modules**
- **Adapter Testing (`adapters/`)** - Language-specific debugger integration validation
- **Core Systems (`core/`)** - Protocol contracts, session management, and server orchestration
- **Proxy Systems (`proxy/`)** - Multi-session debugging architecture and DAP proxy validation
- **Manual Testing (`manual/`)** - Interactive validation utilities for development and troubleshooting

### Supporting Infrastructure Integration

**Test Utilities Ecosystem (`test-utils/`)**
- Comprehensive mocking framework with type-safe mock generation
- Resource management (ports, processes, sessions) with automatic cleanup
- Test fixture generation and debugging scenario templates
- Promise tracking for memory leak detection

**Fixture and Mock Systems (`fixtures/`, `implementations/`)**
- Multi-language debugging targets with predictable execution patterns
- Complete fake implementations for process management and system integration
- Mock DAP servers and protocol simulation infrastructure
- Cross-platform compatibility testing data

**Validation Framework (`validation/`)**
- Breakpoint message testing and debugging behavior validation
- Specification-by-example testing with inline documentation
- Systematic coverage of Python language constructs and error conditions

## Public API Surface and Entry Points

### Primary Test Execution Points

**Framework Integration**
- Vitest-based test execution with comprehensive setup (`vitest.setup.ts`)
- Jest compatibility layer for legacy E2E tests (`jest-register.js`)
- TypeScript runtime compilation support across the test suite

**Language-Specific Testing**
- Complete adapter test suites for Python, JavaScript/TypeScript, Rust, and Go debugging
- Transport mechanism validation (STDIO, Server-Sent Events, Docker)
- Cross-language debugging workflow verification

**System Integration Testing**
- MCP server lifecycle and tool execution validation
- Session management across multiple concurrent debugging sessions
- Debug Adapter Protocol compliance and message handling

### Key Testing Capabilities

**Multi-Transport Validation**
- STDIO transport testing for command-line integration
- SSE transport testing for web-based debugging clients
- Docker containerization testing for isolated deployment scenarios

**Debugging Feature Coverage**
- Breakpoint management (setting, verification, removal)
- Step operations (step over, step into, step out, continue)
- Variable inspection and expression evaluation
- Stack trace analysis and navigation
- Error handling and exception debugging

## Internal Organization and Data Flow

### Test Execution Architecture

**Resource Management Flow**
1. **Setup Phase** - Port allocation, process spawning, session initialization
2. **Execution Phase** - Test scenario execution with controlled environments
3. **Validation Phase** - Result verification and behavior assertion
4. **Cleanup Phase** - Resource deallocation and state reset

**Mock and Integration Strategy**
- **Unit Level** - Comprehensive mocking with fake implementations
- **Integration Level** - Production dependencies with controlled environments  
- **E2E Level** - Real system integration with external tool dependencies
- **Stress Level** - Load testing with performance metric collection

### Quality Assurance Patterns

**Test Isolation and Reliability**
- Unique resource allocation (ports 4000-4999 for stress tests, dedicated ranges per test type)
- Comprehensive cleanup hooks preventing resource leaks
- Cross-platform compatibility with Windows/Unix-specific handling
- Deterministic test data and predictable execution flows

**Error Scenario Coverage**
- Systematic validation of failure modes and error conditions
- Graceful degradation testing for missing dependencies
- Timeout handling and recovery mechanism validation
- Protocol-level error handling and user-friendly error messages

**Performance and Scalability Testing**
- Memory usage monitoring with leak detection
- Connection pooling and concurrent operation validation
- Transport performance characteristics and reliability metrics
- Sustained operation testing with resource usage tracking

This comprehensive testing directory ensures the Debug MCP Server maintains high reliability, performance, and functionality across all supported programming languages, deployment scenarios, and integration patterns while providing developers with robust tools for validation, debugging, and quality assurance.