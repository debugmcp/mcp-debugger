# tests/core/
@generated: 2026-02-09T18:16:56Z

## Overall Purpose and Responsibility

The `tests/core` directory serves as the comprehensive testing foundation for the **DebugMCP Core** system, providing complete validation of all critical debugging components within the Model Context Protocol (MCP) framework. This test suite ensures system reliability, protocol compliance, and integration integrity across the entire Debug Adapter Protocol (DAP) implementation, validating everything from low-level type safety to high-level debugging tool orchestration.

## Key Components and Integration Architecture

### Layered Testing Strategy
The test suite is organized into a cohesive multi-layer architecture that mirrors the production system structure:

**Unit Test Layer** (`unit/`)
- **Server Integration Tests**: Validate the main DebugMCP Server exposing 14 debugging tools through MCP
- **Session Management Tests**: Comprehensive validation of debug session lifecycles and state machine transitions
- **Factory Pattern Tests**: Ensure proper dependency injection and mock framework integration
- **Adapter Type Tests**: Validate complete TypeScript type system for DAP protocol compliance
- **Utility Function Tests**: Test critical system utilities for parameter migration and runtime safety

### Component Interaction Flow
The test components work together to validate the complete debugging pipeline:

1. **Protocol Validation**: Adapter types ensure DAP specification compliance and type safety
2. **Core Logic Testing**: Session management and factory patterns provide the business logic foundation
3. **Service Layer Validation**: Server tests ensure proper MCP integration and tool exposure
4. **Infrastructure Testing**: Utilities and factories provide the supporting framework validation

## Public API Surface and Test Coverage

### Primary Testing Entry Points
- **MCP Tool Interface Testing**: Validation of 14 debugging tools with comprehensive parameter and response testing
- **SessionManager API Coverage**: Complete lifecycle management, DAP operations, and multi-session coordination
- **Factory Pattern Validation**: ProxyManagerFactory and SessionStoreFactory with full mock ecosystem support
- **Type System Compliance**: End-to-end DAP type validation and adapter interface testing
- **Cross-Platform Utilities**: Session migration, serialization safety, and platform-specific functionality

### Critical System Boundaries Validated
- **MCP Protocol Boundaries**: Tool registration, parameter validation, and AI-friendly documentation
- **DAP Communication Layer**: Adapter command validation and protocol message handling
- **IPC Safety Boundaries**: Serialization integrity and inter-process communication
- **Multi-Session Isolation**: Session independence and concurrent debugging support
- **Error Recovery Systems**: Graceful degradation and system resilience under failure conditions

## Internal Organization and Testing Patterns

### Testing Infrastructure
- **Comprehensive Mock Strategy**: All external dependencies isolated through centralized mock factories
- **State Machine Validation**: Session lifecycle transitions and adapter state management testing
- **Dependency Injection Testing**: Consistent mock strategy ensuring component isolation and testability
- **Memory Safety Validation**: Event listener cleanup and resource leak prevention testing

### Quality Assurance Standards
- **Behavioral Verification**: Mock function call patterns and state verification across all components
- **Edge Case Coverage**: Comprehensive testing of error conditions, boundary cases, and race scenarios
- **Performance Validation**: Scalability testing and memory leak prevention across the debugging pipeline
- **Protocol Compliance**: Strict adherence to DAP specification and MCP tool interface requirements

### Data Flow Validation
Tests ensure proper data flow through the complete system:
**MCP Tool Invocation** → **Parameter Validation** → **SessionManager Operations** → **DAP Protocol Communication** → **Debug Adapter Interaction** → **Response Formatting** → **MCP Tool Response**

This directory serves as the complete quality assurance foundation for the DebugMCP system, ensuring reliable debugging functionality, protocol compliance, and system integrity across all supported programming languages and development environments. The comprehensive test coverage provides confidence in the system's ability to handle complex debugging scenarios while maintaining strict protocol adherence and cross-platform compatibility.