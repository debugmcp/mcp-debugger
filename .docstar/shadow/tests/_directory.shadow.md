# tests/
@generated: 2026-02-11T23:48:54Z

## Overall Purpose and Responsibility

The `tests` directory serves as the comprehensive test infrastructure for the entire debugmcp project, providing multi-layered validation of a Model Context Protocol (MCP) debugging system that enables AI agents to perform debugging operations across multiple programming languages (Python, JavaScript, TypeScript, Rust, Go). This test suite ensures the reliability, performance, and protocol compliance of a complete debugging ecosystem that bridges AI agents with language-specific debuggers through standardized protocols.

## System Architecture and Component Integration

The test directory is organized into specialized testing modules that collectively validate the complete debugging infrastructure:

### Core System Validation (`core/`, `unit/`)
- **Foundation Layer**: Validates core adapter interfaces, factory patterns, and MCP protocol compliance across 14 debugging tools
- **Business Logic Layer**: Tests SessionManager operations, Debug Adapter Protocol (DAP) integration, and multi-session coordination
- **API Layer**: Comprehensive validation of all MCP debugging tools (session management, execution control, runtime inspection)

### Language Adapter Testing (`adapters/`)
- **Multi-Language Support**: Comprehensive test suites for Go, JavaScript, Python, and Rust debugging adapters
- **Platform Compatibility**: Cross-platform validation with OS-specific handling for Windows, Linux, and macOS
- **Toolchain Integration**: Validation of external tool dependencies (Delve, debugpy, CodeLLDB) with sophisticated mocking

### End-to-End Validation (`e2e/`, `integration/`)
- **Complete Workflow Testing**: Full debugging sessions from creation through cleanup across all supported languages
- **Deployment Scenarios**: Local development, containerized deployment, and npm package distribution testing
- **Transport Validation**: STDIO and SSE (Server-Sent Events) transport mechanism testing
- **Real-World Simulation**: Integration with actual language runtimes and debugging tools

### Testing Infrastructure (`test-utils/`, `implementations/`, `fixtures/`)
- **Mock Ecosystem**: Comprehensive test doubles for process management, debugging protocols, and system dependencies
- **Resource Management**: Global port allocation, process lifecycle tracking, and conflict prevention
- **Test Fixtures**: Multi-language debugging scenarios, Python script templates, and DAP protocol simulation

## Public API Surface and Entry Points

### Primary Test Execution
- **Framework Integration**: Vitest and Jest test suites with configurable timeouts and cross-platform support
- **Conditional Testing**: Environment-based test activation (e.g., `RUN_STRESS_TESTS`, `SKIP_DOCKER`)
- **Language Detection**: Automatic toolchain availability detection with graceful test skipping

### Key Testing Categories
- **Unit Tests**: Isolated component testing with comprehensive mocking (5679-5779 port range)
- **Integration Tests**: Cross-component workflow validation (5779-5879 port range)  
- **E2E Tests**: Complete system validation with real deployments (5879-5979 port range)
- **Stress Tests**: Transport layer performance and reliability validation under extreme conditions

### Specialized Testing Utilities
- **Debug Session Testing**: Complete debugging workflow orchestration with breakpoint management
- **Protocol Validation**: DAP and MCP protocol compliance testing across all transport mechanisms
- **Environment Management**: Python runtime detection, Docker container management, and npm package testing

## Critical Integration Patterns

### Comprehensive Coverage Strategy
The test suite validates the complete debugging ecosystem through layered testing:
1. **Protocol Layer**: MCP/DAP message handling and transport reliability
2. **Adapter Layer**: Language-specific debugging integration with external tools
3. **Session Layer**: Multi-session debugging coordination and state management  
4. **Infrastructure Layer**: Process management, resource allocation, and cleanup

### Cross-Platform Reliability
- **Platform Abstraction**: Consistent testing across Windows, Linux, and macOS
- **Container Support**: Docker-based testing for deployment scenario validation
- **Dependency Isolation**: Sophisticated mocking prevents external tool requirements while maintaining realistic behavior

### Quality Assurance Patterns
- **Resource Isolation**: Port range separation and process tracking prevent test interference
- **Deterministic Behavior**: Controlled timing and mock responses eliminate test flakiness
- **Comprehensive Cleanup**: Systematic resource deallocation and state reset ensure test independence
- **Progressive Complexity**: Test scenarios range from simple unit validation to complex multi-language debugging workflows

This test directory ensures the debugmcp system can reliably provide VS Code-quality debugging experiences for AI agents across multiple programming languages, with comprehensive validation of protocol compliance, cross-platform compatibility, and production deployment scenarios.