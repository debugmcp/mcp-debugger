# tests/
@generated: 2026-02-12T21:07:03Z

## Overall Purpose and Responsibility

The `tests` directory provides comprehensive validation infrastructure for the debugMCP system - a multi-language debugging platform that enables debugging of Python, JavaScript, TypeScript, Rust, and Go applications through the Debug Adapter Protocol (DAP) and Model Context Protocol (MCP). This testing ecosystem ensures reliability, protocol compliance, and cross-platform compatibility across all debugging workflows from individual component behavior to complete end-to-end debugging scenarios.

## Key Components and Integration

### Multi-Layered Testing Architecture

The testing infrastructure employs a **four-tier validation approach**:

**1. Unit Testing Foundation (`unit/`)**:
- Core system validation including server orchestration, session management, and adapter implementations
- Comprehensive mock infrastructure with 95+ individual test scenarios across 19 MCP tools × 5 languages
- Protocol compliance testing for Debug Adapter Protocol and Model Context Protocol specifications
- Container and cross-platform compatibility validation

**2. Integration Testing (`integration/`, `adapters/`)**:
- Language-specific adapter validation (Go/Delve, JavaScript/Node, Python/debugpy, Rust/CodeLLDB)
- Production environment simulation using real dependency injection containers
- Cross-platform testing with Windows/Unix compatibility and CI environment support
- Complete debugging workflow validation from session creation to variable inspection

**3. End-to-End Testing (`e2e/`)**:
- Full system validation across transport mechanisms (STDIO and SSE)
- Docker containerization and NPM distribution testing
- Real debugging scenarios using example programs and live language runtimes
- Production deployment simulation with comprehensive environment coverage

**4. Specialized Testing Modules**:
- **Stress Testing (`stress/`)**: Transport reliability under high load with connection pooling and metrics collection
- **Manual Testing (`manual/`)**: Interactive validation scripts for SSE protocol and Python debugger integration
- **Validation Framework (`validation/`)**: Systematic breakpoint behavior testing across Python code constructs

### Supporting Infrastructure

**Test Utilities and Fixtures (`test-utils/`, `fixtures/`)**: 
- Comprehensive mock ecosystem with promise leak detection and resource management
- Multi-language debugging fixtures providing controlled test environments
- Port allocation, process tracking, and session management utilities

**Implementation Testing (`implementations/`, `proxy/`)**: 
- Complete test double ecosystem for process management and DAP proxy functionality
- Policy-driven adapter behavior testing with multi-session debugging support
- Controllable process simulation with EventEmitter-based lifecycle management

## Public API Surface

### Primary Entry Points

**Test Execution Framework**:
- Language-specific test suites accessible via standard testing frameworks (Jest, Vitest)
- Conditional test execution based on environment variables (`RUN_STRESS_TESTS`)
- Cross-platform test runner compatibility with CI/CD integration

**Core Testing Capabilities**:
- **MCP Tool Validation**: Complete testing of all 19 debugging tools (session management, execution control, runtime inspection)
- **Transport Testing**: STDIO and SSE protocol validation with bidirectional communication flows
- **Language Matrix Testing**: Comprehensive validation across Python, JavaScript, Rust, Go, and mock adapters
- **Environment Testing**: Docker containers, NPM packages, and cross-platform deployment scenarios

**Mock and Test Infrastructure**:
- `FakeProcessLauncherFactory` - Centralized test double creation for process management
- `createMockLogger/FileSystem/ProcessSpawner/DapClient` - Complete mock factory ecosystem
- `trackPromise()`, `getTestSessionId()` - Resource tracking and session management utilities
- Python fixture servers and debugpy test targets for live debugging validation

### Quality Assurance APIs

**Validation Frameworks**:
- Breakpoint message validation across Python code constructs
- Cross-transport parity testing ensuring identical behavior between STDIO and SSE
- Protocol compliance testing with comprehensive DAP and MCP specification validation
- Performance monitoring with success rate thresholds and memory usage tracking

## Internal Organization and Data Flow

### Test Execution Pipeline

1. **Environment Setup**: System prerequisite validation, mock dependency initialization, and resource allocation
2. **Component Validation**: Factory registration, configuration transformation, and adapter compatibility verification  
3. **Integration Testing**: End-to-end workflow validation through controlled and production-like environments
4. **Specialized Testing**: Stress testing, manual validation, and edge case scenario coverage
5. **Cleanup and Isolation**: Comprehensive resource cleanup, state restoration, and test isolation maintenance

### Cross-Component Integration Patterns

**Mock Coordination**: System mocks work together (process + DAP + filesystem + network) to simulate complete debugging workflows while maintaining deterministic behavior and test isolation.

**Resource Safety**: Automatic cleanup mechanisms, conflict prevention through port allocation, and promise tracking to identify potential memory leaks across test sessions.

**Environment Adaptation**: Dynamic test execution based on available toolchains (Go, Rust, Python, Node.js) with graceful degradation when dependencies are unavailable.

## Critical System Behaviors Validated

### Debugging Workflow Reliability
- Complete debugging session lifecycle from creation through variable inspection to cleanup
- Multi-language debugging with proper adapter selection and configuration
- Breakpoint management, execution control, and runtime state inspection
- Error propagation and recovery mechanisms across all system layers

### Protocol and Platform Compliance  
- Debug Adapter Protocol compliance with proper state machine transitions
- Model Context Protocol implementation with all 19 debugging tools
- Cross-platform compatibility (Windows, Linux, macOS) with proper path handling
- Transport mechanism reliability (STDIO and SSE) under various load conditions

### Production Readiness
- Docker container deployment validation
- NPM package distribution testing
- CI/CD pipeline integration with comprehensive error reporting
- Real-world usage scenario simulation through example programs and live runtimes

This testing infrastructure serves as the definitive quality assurance framework ensuring the debugMCP system provides reliable, protocol-compliant, multi-language debugging capabilities across all supported environments and deployment scenarios.