# tests\core\unit\adapters/
@generated: 2026-02-12T21:05:42Z

## Core Adapter Unit Tests

This directory contains comprehensive unit test suites that validate the foundational components and interfaces of the debug adapter system, specifically focusing on the shared contracts and types that define the debugging protocol.

### Overall Purpose

The `tests/core/unit/adapters` directory serves as the primary validation layer for the debug adapter interface specifications. It ensures that all core enums, error classes, type interfaces, and data structures from the `@debugmcp/shared` package maintain their expected contracts and behaviors. These tests act as a safety net for the shared debugging protocol that underlies the entire MCP debug system.

### Key Components & Architecture

**Debug Adapter Interface Validation (`debug-adapter-interface.test.ts`)**:
- **Lifecycle Management**: Validates the 7-state adapter lifecycle (uninitialized → ready → debugging → error)
- **Error Classification**: Tests 13 categorized error codes across environment, connection, protocol, and runtime failures
- **Feature Capabilities**: Validates 20+ debug protocol features including breakpoints, variable inspection, and step debugging
- **Type Safety**: Ensures proper constraints and type safety across 40+ interface properties

### Public API Coverage

The test suite comprehensively covers the public API surface of the debug adapter system:

**Core Enums**:
- `AdapterState` - Lifecycle state management
- `AdapterErrorCode` - Standardized error classification  
- `DebugFeature` - Protocol capability flags

**Error Handling**:
- `AdapterError` class with categorization and recovery strategies
- Error propagation patterns and recovery mechanisms

**Configuration Interfaces**:
- `AdapterConfig` - Complete adapter setup and configuration
- `GenericLaunchConfig` & `LanguageSpecificLaunchConfig` - Launch parameter management
- `AdapterCapabilities` - Feature flag declarations
- `FeatureRequirement` - Dependency and version constraint specifications

**Validation & Metadata**:
- `ValidationResult` - Configuration validation outcomes
- `DependencyInfo` - Runtime dependency tracking
- `ExceptionBreakpointFilter` - Exception handling configuration

### Testing Strategy & Patterns

The directory employs systematic validation patterns:
- **Enum Completeness**: Ensures all enum values are properly defined and accessible
- **Interface Compliance**: Validates complex nested object structures match specifications
- **Error Boundary Testing**: Verifies error categorization and recovery flag behavior
- **Type Constraint Validation**: Confirms proper TypeScript type safety enforcement

### Integration with Larger System

These unit tests serve as the foundational contract validation for:
- Debug adapter implementations that must conform to these interfaces
- Protocol message serialization/deserialization processes
- Error handling and recovery mechanisms across the debugging system
- Feature capability negotiation between debug clients and adapters

The test suite acts as living documentation for the debug adapter protocol, ensuring that any changes to the shared interfaces maintain backward compatibility and expected behaviors across the entire MCP debug ecosystem.