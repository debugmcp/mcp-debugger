# tests/
@children-hash: eadd21f9960b082b
@generated: 2026-02-24T18:27:55Z

## Overall Purpose and Responsibility

The `tests` directory serves as the comprehensive testing infrastructure for the MCP (Model Context Protocol) debugger system, providing complete validation coverage from unit tests to end-to-end integration across multiple programming languages, transport mechanisms, and deployment environments. This directory ensures system reliability, protocol compliance, and cross-platform compatibility through a multi-layered testing approach that validates everything from low-level utilities to complete debugging workflows.

## Testing Architecture and Strategy

### Multi-Layered Testing Approach
The directory implements a sophisticated testing strategy with distinct validation layers:

- **Unit Tests (`unit/`)**: Isolated component testing with comprehensive mocking for core system validation
- **Integration Tests (`integration/`)**: Real-world component interaction testing with production dependencies  
- **End-to-End Tests (`e2e/`)**: Complete workflow validation across languages, transports, and deployment methods
- **Stress Testing (`stress/`)**: Performance and reliability validation under extreme conditions

### Language Coverage Matrix
The testing infrastructure provides comprehensive coverage across all supported debugging environments:
- **Python**: Complete debugpy integration with DAP protocol testing
- **JavaScript/TypeScript**: Node.js and tsx runtime debugging validation
- **Rust**: CodeLLDB integration and Cargo project support
- **Go**: Delve debugger integration with cross-platform toolchain support
- **Mock Adapters**: Synthetic testing environment for isolated validation

## Key Components and Integration Flow

### Core Testing Infrastructure
- **Test Utilities (`test-utils/`)**: Centralized infrastructure providing mocks, fixtures, resource management, and testing helpers
- **Fixtures (`fixtures/`)**: Controlled test environments with predictable debugging targets across multiple languages
- **Implementations (`implementations/`)**: Comprehensive fake process and launcher implementations for deterministic testing

### Specialized Testing Domains
- **Adapter Testing (`adapters/`)**: Language-specific debug adapter validation with factory pattern testing
- **Core System Testing (`core/`)**: Protocol compliance, session management, and MCP server functionality validation
- **Proxy System Testing (`proxy/`)**: DAP proxy validation with multi-session debugging and adapter-specific policies
- **Validation Testing (`validation/`)**: Breakpoint placement and debugging behavior specification testing

### Cross-Transport Validation
The testing suite ensures consistent behavior across multiple transport mechanisms:
- **STDIO Transport**: Process-based communication testing
- **SSE Transport**: Server-Sent Events with session management
- **Docker Deployment**: Container-based debugging validation
- **NPM Distribution**: Package distribution and installation testing

## Public API Surface and Entry Points

### Primary Test Execution Points
- **Unit Test Suite**: Comprehensive component testing via `unit/` with full mocking infrastructure
- **Language-Specific Smoke Tests**: End-to-end workflow validation per supported language
- **Cross-Platform Integration**: Platform-aware testing with Windows/Linux/macOS compatibility
- **Performance Validation**: Stress testing for transport reliability and system performance

### Testing Utilities Interface
- **Resource Management**: Port allocation, process tracking, and cleanup coordination
- **Mock Infrastructure**: Sophisticated dependency injection with fake implementations
- **Session Management**: Debug session lifecycle testing with state transition validation  
- **Environment Detection**: Runtime availability testing for language toolchains

### Validation Framework
- **Protocol Compliance**: MCP and DAP message handling verification
- **Debugging Workflow**: Complete session lifecycle from creation to cleanup
- **Error Handling**: Comprehensive failure scenario and recovery testing
- **Cross-Language Consistency**: Uniform debugging behavior across supported languages

## Internal Organization and Data Flow

### Test Execution Architecture
1. **Foundation Layer**: Mock infrastructure and test utilities provide isolated testing environment
2. **Component Layer**: Unit tests validate individual system components with comprehensive mocking
3. **Integration Layer**: Real dependency testing ensures proper component interaction
4. **System Layer**: End-to-end tests validate complete debugging workflows
5. **Performance Layer**: Stress tests ensure reliability under load conditions

### Resource Coordination
The testing infrastructure implements sophisticated resource management:
- **Port Management**: Dedicated port ranges prevent test conflicts
- **Process Tracking**: Automated cleanup prevents resource leaks
- **Session Isolation**: Unique session IDs ensure test independence
- **Environment Preservation**: System state restoration between test runs

### Quality Assurance Patterns
- **Comprehensive Mocking**: Complete external dependency isolation
- **Cross-Platform Testing**: Platform-specific behavior validation
- **Protocol Validation**: Strict adherence to debugging protocol specifications
- **Regression Prevention**: Automated validation against known failure modes

## Important Testing Conventions

### Test Design Principles
- **Deterministic Behavior**: Predictable test outcomes through controlled environments
- **Resource Isolation**: Comprehensive cleanup preventing cross-test pollution
- **Error Resilience**: Extensive failure scenario testing and graceful degradation
- **Performance Awareness**: Timeout configurations and resource usage monitoring

### Integration Standards
- **Transport Parity**: Identical behavior validation across different communication mechanisms  
- **Language Consistency**: Uniform debugging capabilities across programming languages
- **Deployment Flexibility**: Testing across various deployment scenarios (local, Docker, NPM)
- **Protocol Compliance**: Strict adherence to MCP and DAP specifications

This comprehensive testing directory ensures the MCP debugger system maintains high reliability, consistent behavior, and robust error handling across all supported programming languages, deployment environments, and usage scenarios through systematic automated validation.