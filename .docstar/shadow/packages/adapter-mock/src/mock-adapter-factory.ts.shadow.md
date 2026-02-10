# packages/adapter-mock/src/mock-adapter-factory.ts
@source-hash: cadb274391dfa46e
@generated: 2026-02-10T00:41:20Z

## Purpose
Factory implementation for creating mock debug adapter instances for testing the MCP debugger system without external dependencies.

## Key Classes and Functions

### MockAdapterFactory (L21-91)
- **Purpose**: Implements `IAdapterFactory` interface to create `MockDebugAdapter` instances
- **Constructor** (L24-26): Accepts optional `MockAdapterConfig` for customization
- **createAdapter()** (L31-33): Creates new `MockDebugAdapter` with provided dependencies and stored config
- **getMetadata()** (L38-50): Returns static metadata including language (MOCK), version (1.0.0), file extensions (.mock, .test), and embedded SVG icon
- **validate()** (L55-90): Performs configuration validation with simulated checks for Node.js runtime, error probability warnings (>50%), and delay warnings (>1000ms)

### createMockAdapterFactory() (L96-98)
- **Purpose**: Convenience factory function to create `MockAdapterFactory` instances
- **Parameters**: Optional `MockAdapterConfig`
- **Returns**: New `MockAdapterFactory` instance

## Dependencies
- **@debugmcp/shared**: Core interfaces (`IAdapterFactory`, `AdapterDependencies`, `AdapterMetadata`, `FactoryValidationResult`, `IDebugAdapter`, `DebugLanguage`)
- **./mock-debug-adapter.js**: `MockDebugAdapter` class and `MockAdapterConfig` type

## Architecture Patterns
- **Factory Pattern**: Encapsulates adapter creation logic
- **Configuration Injection**: Constructor accepts config for customizable behavior
- **Interface Implementation**: Strict adherence to `IAdapterFactory` contract
- **Validation Strategy**: Async validation with structured error/warning reporting

## Key Constraints
- Designed specifically for testing scenarios (no real debugger dependencies)
- Mock adapter operates with simulated behavior controlled by configuration
- Validation always passes unless Node.js runtime missing (unlikely scenario)
- Error probability and delay thresholds trigger validation warnings but don't fail validation