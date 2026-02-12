# tests/
@generated: 2026-02-12T21:02:11Z

## Overall Purpose and Responsibility

The `tests` directory serves as the comprehensive testing infrastructure for the MCP (Model Context Protocol) Debug Server system. This directory ensures the reliability, correctness, and robustness of multi-language debugging capabilities through a sophisticated multi-layered testing architecture that validates everything from core utilities to end-to-end debugging workflows across Python, JavaScript, Go, and Rust environments.

## Key Components and Architecture

### Testing Layer Hierarchy
The directory implements a **five-tier testing strategy** that builds from isolated units to complete system validation:

1. **Unit Testing Layer** (`unit/`, `test-utils/`, `implementations/`) - Component-level validation with comprehensive mocking
2. **Integration Testing Layer** (`integration/`, `core/`) - Cross-component interaction validation with real dependencies
3. **Adapter Testing Layer** (`adapters/`) - Language-specific debugging adapter validation across all supported languages
4. **End-to-End Testing Layer** (`e2e/`) - Complete debugging workflows from session creation through cleanup
5. **Stress Testing Layer** (`stress/`, `proxy/`) - High-load validation and transport protocol reliability testing

### Core Testing Infrastructure
- **Mock Framework** (`implementations/`, `test-utils/`) - Complete replacement of external dependencies with controllable test doubles
- **Test Fixtures** (`fixtures/`, `validation/`) - Standardized debugging targets and scenarios across multiple languages
- **Resource Management** (`test-utils/helpers/`) - Port allocation, process tracking, and cleanup automation
- **Cross-Platform Support** - Comprehensive Windows, Linux, and macOS compatibility testing

### Language Adapter Ecosystem
Each supported language has dedicated test coverage:
- **Python**: Complete debugpy integration, environment detection, and protocol compliance
- **JavaScript/TypeScript**: tsx runtime integration, source map support, and E2E workflows
- **Go**: Delve debugger integration with DAP protocol validation
- **Rust**: CodeLLDB adapter functionality with cross-platform command generation

## Public API Surface and Entry Points

### Primary Test Execution Interfaces

**Framework Integration Points**:
- `vitest.setup.ts` - Global test configuration with ESM support and cross-platform compatibility
- `jest-register.js` - TypeScript runtime compilation for legacy Jest-based tests
- Test runner configuration with automatic cleanup and resource management

**Development Testing Tools**:
- `mcp_debug_test.js` - Standalone integration test simulating complete LLM debugging workflow
- Manual testing utilities (`manual/`) for SSE protocol validation and debugger instantiation
- Cross-transport parity testing ensuring identical behavior across STDIO and SSE protocols

**CI/CD Integration**:
- Comprehensive test matrices with conditional execution based on environment availability
- Docker-based testing for isolated environments and deployment validation
- npm package distribution testing for end-to-end release validation

### Core Testing APIs

**Session Management Testing**:
- Complete debugging lifecycle validation from session creation through cleanup
- Multi-session isolation and concurrent debugging capability testing
- Debug Adapter Protocol (DAP) compliance across all language adapters

**Transport Protocol Validation**:
- STDIO and SSE (Server-Sent Events) transport mechanism testing
- Cross-transport result consistency validation
- Protocol reliability under stress conditions and failure scenarios

**Adapter System Testing**:
- Dynamic adapter loading and registration validation
- Language-specific debugging behavior testing (breakpoints, stepping, variable inspection)
- Cross-platform executable discovery and toolchain integration

## Internal Organization and Data Flow

### Testing Architecture Pattern
The directory follows a **dependency injection and mock-based isolation** pattern:

1. **Setup Phase**: Test environments created with injected mock dependencies
2. **Execution Phase**: Components tested against controlled, predictable mock behavior
3. **Validation Phase**: Outcomes verified against expected behavior patterns
4. **Cleanup Phase**: Automatic resource cleanup with leak detection and prevention

### Cross-Component Integration Testing
Critical integration points are systematically validated:
- **CLI → Server Factory → Transport**: Command-line interface properly initializes debugging servers
- **Session Manager → Adapter Registry → DAP Communication**: Complete debugging session orchestration
- **Proxy System → Multi-Session Management**: Complex debugging scenarios with session isolation
- **Container Awareness → Path Resolution**: Deployment environment detection and adaptation

### Resource Management Strategy
- **Port Allocation**: Centralized port manager prevents conflicts across concurrent tests
- **Process Tracking**: Global registry of spawned processes with automatic cleanup
- **Promise Lifecycle Management**: Memory leak detection and prevention through promise tracking
- **Session Correlation**: Unique session IDs enable resource tracking back to specific tests

## Important Patterns and Conventions

### Test Isolation and Reliability
- **Comprehensive Mocking**: All external dependencies replaced with controllable test doubles
- **Deterministic Behavior**: Fake timers, predictable process responses, and controlled async execution
- **Resource Safety**: Systematic cleanup preventing test pollution and resource leaks
- **Cross-Platform Testing**: Platform-specific behavior validation with environment detection

### Quality Assurance Features
- **Error Path Coverage**: Extensive validation of failure scenarios, timeout conditions, and edge cases
- **Protocol Compliance**: Strict adherence to MCP and DAP protocol specifications
- **Performance Validation**: Response time monitoring and resource usage constraints
- **Multi-Language Consistency**: Uniform debugging behavior across all supported language adapters

### Development Experience
- **Factory Pattern**: Consistent test environment creation across all test categories
- **Type Safety**: Mock implementations maintain interface compatibility with production code
- **Rich Debugging**: Detailed error messages, timing information, and test execution tracking
- **CI-Friendly**: Environment-based test skipping and graceful degradation for missing dependencies

## Role in Larger System

This comprehensive test directory serves as the **quality gate** for the entire MCP Debug Server system, ensuring:
- Reliable multi-language debugging capabilities across diverse development environments
- Robust error handling and graceful degradation under failure conditions  
- Cross-platform compatibility and consistent behavior across deployment scenarios
- Protocol compliance and integration compatibility with MCP and DAP specifications
- Performance and reliability under production load conditions

The testing infrastructure enables confident development and deployment of complex debugging functionality while maintaining strict quality standards and preventing regressions across the entire debugging ecosystem.