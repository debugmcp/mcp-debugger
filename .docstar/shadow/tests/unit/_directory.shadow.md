# tests\unit/
@children-hash: d6a8d90ce170685a
@generated: 2026-02-24T18:27:26Z

## Overall Purpose

The `tests/unit` directory provides comprehensive unit test coverage for the entire Debug MCP Server system, ensuring reliable operation of all components through isolated testing with extensive mocking infrastructure. The test suite validates everything from high-level orchestration down to low-level utility functions, providing confidence in system reliability across multiple programming language debug adapters, transport modes, and deployment environments.

## Architecture & Component Organization

### Core System Testing
- **Main Entry Point** (`index.test.ts`): Tests CLI initialization, command setup, and server factory orchestration with comprehensive dependency mocking
- **Server Lifecycle** (`server-coverage.test.ts`): Validates DebugMcpServer error paths, edge cases, and boundary scenarios beyond happy-path testing
- **Session Management** (`session-manager-operations-coverage.test.ts`): Extensive coverage of session operations, proxy management, and debugging workflow error handling

### Language Adapter System
- **Adapter Infrastructure** (`adapters/`): Tests dynamic adapter loading, registry management, lifecycle coordination, and specialized implementations (JavaScript, Mock)
- **Python Support** (`adapter-python/`): Comprehensive Python debug adapter testing including environment validation, debugpy integration, and DAP protocol handling
- **Shared Components** (`shared/`): Tests adapter policies, filesystem abstractions, and cross-language debugging behaviors

### Communication & Protocol Layer
- **CLI Interface** (`cli/`): Validates command-line interface, transport modes (stdio/SSE), error handling, and utility functions
- **Proxy System** (`proxy/`): Tests DAP proxy subsystem including connection management, message parsing, request tracking, and process lifecycle
- **DAP Core** (`dap-core/`): Validates Debug Adapter Protocol message handling and state management for proxy-based debug sessions

### Infrastructure & Support
- **Dependency Injection** (`container/`): Tests production dependency wiring, adapter registration, and environment-specific configuration
- **Implementation Layer** (`implementations/`): Validates concrete classes for environment management, file operations, network handling, and process lifecycle
- **Utilities** (`utils/`): Tests path resolution, error handling, logging, file operations, and language configuration management

### Testing Infrastructure
- **Test Utilities** (`test-utils/`): Provides mock generation engine, standardized factories, and specialized test doubles for complex components

## Key Testing Patterns

### Mock Strategy
- **Comprehensive Isolation**: All external dependencies mocked using Vitest framework with extensive module replacement
- **Interface Validation**: Automated mock-implementation consistency checking to prevent drift
- **Dependency Injection**: Standardized patterns for injecting test doubles throughout component hierarchy

### Coverage Philosophy
- **Error Path Focus**: Extensive testing of failure scenarios, edge cases, and boundary conditions beyond happy paths
- **Cross-Environment Support**: Container vs host mode testing, platform-specific behaviors, and deployment scenario validation
- **Protocol Compliance**: Thorough validation of Debug Adapter Protocol (DAP) message handling and state management

### Test Organization
- **Layered Testing**: From high-level orchestration through low-level utilities with clear separation of concerns
- **Resource Management**: Systematic cleanup patterns, mock state isolation, and environment variable preservation
- **Async Coordination**: Proper handling of Promise-based operations, event-driven communication, and timing scenarios

## Public API Validation

The test suite validates all major system entry points:

### Primary Interfaces
- **Main Entry** (`main()` function): CLI initialization and server bootstrapping
- **Server Factory** (`createDebugMcpServer()`): Server instance creation with configuration
- **Transport Handlers** (`handleStdioCommand()`, `handleSseCommand()`): Transport-specific server startup

### Adapter System
- **Dynamic Loading** (`loadAdapter()`, `isAdapterAvailable()`): Adapter discovery and availability checking
- **Registry Management** (`register()`, `createAdapter()`): Factory registration and instance creation
- **Language Support**: Python, JavaScript, and extensible adapter architecture

### Debug Operations
- **Session Management**: Debug session creation, lifecycle, and cleanup
- **DAP Protocol**: Message handling, request tracking, and event forwarding
- **Proxy Communication**: Process management, connection handling, and error recovery

## Integration & Data Flow

The test suite ensures proper integration across the complete system stack:

1. **Entry Layer**: CLI commands route to appropriate transport handlers with proper dependency injection
2. **Transport Layer**: Stdio and SSE transports properly initialize MCP servers with debug capabilities
3. **Server Layer**: DebugMcpServer orchestrates session management through adapter registry and proxy system
4. **Adapter Layer**: Language-specific adapters handle debugging protocol integration and environment management
5. **Infrastructure Layer**: File system, network, and process management provide reliable foundation services

## Critical Testing Behaviors

### System Reliability
- Comprehensive error handling and recovery testing
- Resource cleanup and lifecycle management validation
- Cross-platform compatibility and container environment support

### Protocol Compliance
- Debug Adapter Protocol message parsing and correlation
- Request/response handling with proper timeout management
- Event-driven communication and state synchronization

### Development Support
- Extensive mock infrastructure for isolated component testing
- Test utilities enabling rapid test development and maintenance
- Automated validation preventing mock-implementation drift

This comprehensive test suite provides confidence that the Debug MCP Server can reliably manage debugging sessions across multiple programming languages while handling various deployment scenarios, transport modes, and error conditions gracefully.