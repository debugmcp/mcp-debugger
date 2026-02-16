# tests/
@children-hash: fa45404524f395a6
@generated: 2026-02-16T08:24:58Z

## Overall Purpose and Responsibility

The `tests` directory provides comprehensive test coverage for the Debug MCP Server, a system that enables AI agents to perform debugging operations across multiple programming languages through the Model Context Protocol (MCP). This test suite validates the entire debugging infrastructure from protocol contracts through language-specific adapters, ensuring reliable debugging capabilities for JavaScript, Python, Rust, and Go applications in both local and containerized environments.

## Key Components and Architecture Integration

### Multi-Layer Testing Strategy
The directory implements a complete testing pyramid spanning multiple validation layers:

- **Unit Tests** (`unit/`): Comprehensive component-level validation covering core services, adapters, CLI interfaces, session management, and DAP protocol implementation
- **Integration Tests** (`integration/`): End-to-end validation of complete debugging workflows with real dependencies and file system interactions
- **End-to-End Tests** (`e2e/`): Production-like testing across transport mechanisms (STDIO, SSE), deployment scenarios (Docker, NPX), and all supported programming languages
- **Stress Tests** (`stress/`): Load testing and transport parity validation ensuring reliability under extreme conditions

### Cross-Language Adapter Testing
Four language-specific test suites validate debugging capabilities:
- **Go Adapter Tests** (`adapters/go/`): Delve debugger integration with GOPATH/GOBIN discovery
- **JavaScript/TypeScript Tests** (`adapters/javascript/`): VS Code js-debug adapter with tsx runtime support  
- **Python Adapter Tests** (`adapters/python/`): debugpy integration with MCP client-server communication
- **Rust Adapter Tests** (`adapters/rust/`): CodeLLDB integration with cross-platform compilation testing

### Supporting Infrastructure
- **Test Utilities** (`test-utils/`): Comprehensive testing infrastructure including mocks, fixtures, resource management, and environment detection
- **Test Fixtures** (`fixtures/`): Multi-language code samples for controlled debugging scenarios
- **Validation Data** (`validation/`): Specialized test data for breakpoint behavior and debugging protocol validation

## Public API Surface and Entry Points

### Primary Test Categories

**Core System Validation:**
- **MCP Protocol Testing**: All 19 MCP debugging tools validated across language matrix with transport compatibility
- **Session Management**: Debug session lifecycle, multi-session concurrency, and resource cleanup
- **Adapter System**: Dynamic adapter loading, language detection, and debugger integration
- **Transport Mechanisms**: STDIO and SSE protocol validation with production configuration testing

**Language-Specific Entry Points:**
- Smoke tests for each supported language: `mcp-server-smoke-{language}.test.ts`
- Adapter-specific validation suites testing factory patterns, configuration processing, and command generation
- Cross-platform compatibility testing including Windows, Linux, and macOS scenarios

**Infrastructure Validation:**
- CLI interface testing with command parsing and server initialization
- Dependency injection container validation ensuring proper service wiring
- Error handling and graceful degradation across all system components

### Key Testing Utilities

**Resource Management:**
- Port allocation system preventing test conflicts across concurrent execution
- Process lifecycle management with automatic cleanup and termination
- Session ID generation and correlation for debugging test failures

**Mock Infrastructure:**
- Complete system interface mocking (filesystem, process spawning, network operations)
- DAP protocol simulation with configurable behavior and error injection
- Language-specific debugger mocking for isolated unit testing

## Internal Organization and Data Flow

### Test Execution Architecture

The test suite follows a hierarchical validation approach:

1. **Foundation Layer**: Unit tests validate individual components with comprehensive mocking
2. **Integration Layer**: Tests validate component interactions with controlled real dependencies  
3. **System Layer**: E2E tests validate complete workflows in production-like environments
4. **Stress Layer**: Load and parity tests ensure reliability under extreme conditions

### Quality Assurance Patterns

**Test Isolation Strategy:**
- Each test receives dedicated resources (ports, processes, temporary directories) with automatic cleanup
- Comprehensive mock factories provide deterministic behavior while preventing external dependencies
- Session-based tracking correlates resources across test execution for debugging failures

**Cross-Platform Testing:**
- Platform-specific executable resolution and path normalization
- Docker-based testing for consistent Linux environments
- Windows-specific handling for path differences and executable extensions

**Error Scenario Coverage:**
- Systematic testing of failure modes including missing tools, network failures, and protocol errors
- Graceful degradation validation ensuring user-friendly error messages
- Resource leak prevention through comprehensive cleanup patterns

### Critical Integration Points

**MCP Protocol Validation:**
- Complete tool matrix testing (19 tools × 4+ languages) with detailed PASS/FAIL reporting
- Transport protocol compatibility testing ensuring production deployment readiness  
- DAP integration testing through MCP tool abstractions with real debugger backends

**Production Environment Simulation:**
- Real language runtimes and debuggers (not mocked) in integration and E2E scenarios
- Docker containerization matching production deployment patterns
- NPX distribution testing validating global installation workflows

This comprehensive test directory ensures the Debug MCP Server provides reliable, type-safe debugging capabilities across all supported languages and deployment environments, with extensive validation of error conditions, resource management, and protocol compliance.