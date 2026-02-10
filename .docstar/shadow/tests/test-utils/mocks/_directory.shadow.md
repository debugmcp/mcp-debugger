# tests/test-utils/mocks/
@generated: 2026-02-09T18:16:11Z

## Purpose
Test utilities directory providing comprehensive mocking infrastructure for unit testing across the debugger framework. Centralizes mock implementations of external dependencies, system resources, and internal interfaces to enable isolated, deterministic testing without real filesystem, network, or process interactions.

## Architecture Overview

### System-Level Mocks
Core infrastructure mocks for Node.js built-in modules:
- **child-process.ts**: Complete child_process module simulation with process spawning, IPC communication, and specialized Python/proxy process behaviors
- **fs-extra.ts**: Filesystem operations stubbing (ensureDir, pathExists) to avoid actual file I/O
- **net.ts**: TCP server mocking for network-related testing scenarios
- **environment.ts**: Environment variable and platform detection mocking

### Framework Component Mocks  
Application-specific interface mocks:
- **dap-client.ts**: Debug Adapter Protocol client simulation with event handling and error scenarios
- **mock-adapter-registry.ts**: Complete IAdapterRegistry implementation with realistic adapter behaviors and language support
- **mock-command-finder.ts**: CommandFinder interface mock for controlled command path resolution
- **mock-proxy-manager.ts**: ProxyManager implementation with full DAP protocol handling and event simulation

### Testing Infrastructure Mocks
Support utilities for test environment:
- **mock-logger.ts**: ILogger implementations (silent and console-logging variants) for test scenarios

## Key Integration Patterns

### Behavioral Consistency
All mocks follow consistent patterns:
- **Vitest Integration**: Extensive use of `vi.fn()` for method spying and call verification
- **Realistic Defaults**: Sensible default behaviors that mirror real implementations
- **State Management**: Comprehensive reset() methods for test isolation
- **Event Simulation**: EventEmitter-based mocks support realistic async testing scenarios

### Specialized Testing Support
- **Python Process Testing**: child-process.ts provides specialized Python spawn behaviors and version detection
- **DAP Protocol Testing**: Both dap-client.ts and mock-proxy-manager.ts support complete Debug Adapter Protocol workflows
- **Error Scenario Testing**: Most mocks include configurable error injection capabilities
- **Call History Tracking**: Comprehensive verification support through call recording and assertion helpers

## Public API Entry Points

### Primary Mock Factories
- `createMockAdapterRegistry()` - Standard adapter registry with Python/Mock language support
- `createEnvironmentMock()` - Environment variable access with container mode defaults  
- `createMockLogger()` - Silent logger for unit tests
- `createSpyLogger()` - Console-logging spy for integration tests

### Singleton Instances
- `childProcessMock` - Ready-to-use child process mock orchestrator
- `mockDapClient` - Pre-configured DAP client instance
- `fsExtraMock` - Filesystem operations mock
- `netMock` - Network server creation mock

### Mock Classes
- `MockChildProcess` - Individual process simulation
- `MockCommandFinder` - Command path resolution testing
- `MockProxyManager` - Complete proxy lifecycle and DAP handling

## Usage Patterns
Designed for dependency injection in unit tests, these mocks enable:
- **Isolated Testing**: No external system dependencies
- **Behavioral Control**: Configurable responses and error injection
- **Comprehensive Verification**: Call history tracking and event assertions
- **Realistic Simulation**: Authentic async behaviors and protocol handling

The directory serves as the foundation for reliable, fast unit testing across the entire debugger framework, providing both simple stub functionality and sophisticated behavioral simulation as needed.