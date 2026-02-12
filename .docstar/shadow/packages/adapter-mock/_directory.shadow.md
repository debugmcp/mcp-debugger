# packages/adapter-mock/
@generated: 2026-02-11T23:48:13Z

## Purpose

The `packages/adapter-mock` directory provides a complete mock debug adapter implementation for testing the MCP (Message Control Protocol) debugger infrastructure. This package serves as a comprehensive test double that simulates real Debug Adapter Protocol (DAP) operations without external dependencies, enabling reliable development and testing of debug clients and framework components.

## Architecture Overview

The package follows a layered architecture with clear separation between production code and comprehensive testing infrastructure:

### Production Components (`src/`)
- **MockAdapterFactory**: Entry point implementing `IAdapterFactory` for dependency injection and framework integration
- **MockDebugAdapter**: Core adapter implementing `IDebugAdapter` interface with full DAP simulation and configurable behavior
- **MockDebugAdapterProcess**: Standalone DAP server supporting stdio/TCP communication for integration testing
- **Configuration System**: Comprehensive configuration options for error scenarios, timing control, and feature toggling

### Testing Infrastructure (`tests/`)
- **Integration Tests**: Package-level export validation and basic factory integration
- **Unit Tests**: Comprehensive coverage of factory, adapter lifecycle, and DAP compliance
- **Test Utilities**: Shared dependency mocking patterns and state validation helpers

### Development Configuration
- **Vitest Setup**: TypeScript-first testing environment with workspace integration and module resolution

## Key Integration Patterns

### Factory Pattern Integration
The `MockAdapterFactory` serves as the primary integration point, implementing the standard `IAdapterFactory` interface to enable seamless substitution in debug frameworks. It provides:
- Adapter instance creation with customizable configuration
- Metadata reporting (language support, versions, capabilities)
- Configuration validation with developer warnings

### Event-Driven Communication
The `MockDebugAdapter` follows standard EventEmitter patterns for lifecycle management:
- State transitions: INITIALIZING → READY → CONNECTED → DEBUGGING
- DAP event propagation ('stopped', 'terminated', 'connected', 'disconnected')
- Error scenario simulation through configurable `MockErrorScenario` types

### Protocol Simulation
The mock adapter provides realistic DAP behavior through:
- Complete command handler implementations (16+ DAP commands)
- Configurable timing delays and performance simulation
- Realistic debugging state management (breakpoints, variables, stack traces)
- Error injection capabilities for negative testing scenarios

## Public API Surface

### Primary Exports
- `MockAdapterFactory` - Main factory class for framework integration
- `MockDebugAdapter` - Core adapter implementation
- `MockErrorScenario` - Enumeration of error simulation types
- `MockAdapterConfig` - Configuration interface for behavior customization

### Factory Function
- `createMockAdapterFactory(config?)` - Convenience constructor with optional configuration

### Configuration Options
- Error simulation scenarios (crashes, timeouts, invalid states)
- Timing control for operation delays
- Feature support toggles for capability testing
- Performance simulation modes

## Internal Data Flow

1. **Configuration Propagation**: `MockAdapterConfig` flows from factory through adapter to control all behavioral aspects
2. **State Management**: Adapter maintains strict state transitions following DAP lifecycle requirements
3. **Event Processing**: Standard EventEmitter patterns propagate adapter events to consumers
4. **Protocol Handling**: DAP messages are processed through realistic handlers with configurable responses

## Testing Capabilities

The package enables comprehensive testing scenarios:
- **Unit Testing**: Complete adapter lifecycle validation with state transition verification
- **Integration Testing**: Package export validation and factory pattern testing
- **Error Simulation**: Configurable failure modes for robust negative testing
- **Performance Testing**: Simulated CPU/memory intensive operations
- **Protocol Compliance**: Full DAP event handling and feature support validation

## Framework Integration

This mock adapter integrates seamlessly with the broader MCP debug system through:
- **Interface Compliance**: Strict adherence to `IDebugAdapter` and `IAdapterFactory` contracts from `@debugmcp/shared`
- **Dependency Injection**: Factory pattern enables clean integration with debug frameworks
- **Workspace Integration**: Monorepo setup with shared dependencies and consistent build/test configuration
- **TypeScript Support**: Full type safety with extension handling for compatibility

The mock adapter serves as both a development tool and a comprehensive testing foundation, providing reliable simulation of debug adapter behavior while supporting extensive customization for various testing scenarios.