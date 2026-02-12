# tests/core/unit/adapters/
@generated: 2026-02-11T23:47:37Z

## Purpose and Responsibility

This directory contains comprehensive unit tests for the core adapter interface components of the @debugmcp/shared package. It validates the foundational types, enums, and error handling mechanisms that define the contract between debug adapters and the MCP system.

## Key Components

### Core Interface Validation
- **State Management Testing**: Validates the 7-state adapter lifecycle (uninitialized → ready → debugging → error) through `AdapterState` enum tests
- **Error Classification Testing**: Comprehensive validation of 13 error codes across environment, connection, protocol, and runtime failure categories via `AdapterErrorCode` enum
- **Feature Capability Testing**: Tests 20 debug protocol features (breakpoints, variable inspection, step debugging) through `DebugFeature` enum validation
- **Custom Error Handling**: Validates `AdapterError` class with proper error categorization and recovery strategy flags

### Configuration and Metadata Testing
- **Adapter Configuration**: Tests complete adapter setup including session management, file paths, and launch configurations
- **Dependency Management**: Validates dependency metadata with version requirements and compatibility checking
- **Command Execution**: Tests adapter command configuration with environment variable support
- **Launch Configuration**: Validates both generic and language-specific launch options

### Advanced Protocol Features
- **Capability Declaration**: Tests extensive debug protocol capability flags for feature negotiation
- **Exception Handling**: Validates exception breakpoint filtering and categorization
- **Requirement Specification**: Tests dependency, version, and configuration requirement types
- **Validation Framework**: Tests validation result structures with error/warning collections

## Public API Surface

The tests validate the complete public interface of the debug adapter system:
- **Enums**: `AdapterState`, `AdapterErrorCode`, `DebugFeature` - core system state and capability definitions
- **Error Classes**: `AdapterError` - standardized error handling with recovery strategies
- **Configuration Types**: `AdapterConfig`, `GenericLaunchConfig`, `LanguageSpecificLaunchConfig` - adapter setup
- **Metadata Types**: `DependencyInfo`, `AdapterCapabilities`, `FeatureRequirement` - system introspection
- **Validation Types**: `ValidationResult`, `ExceptionBreakpointFilter` - runtime validation and filtering

## Internal Organization

The test suite follows a hierarchical structure:
1. **Enum validation** (L26-106) - tests foundational state and capability enumerations
2. **Error class testing** (L108-141) - validates custom error handling mechanisms
3. **Type interface testing** (L143-485) - comprehensive validation of complex configuration and metadata types
4. **Error handling patterns** (L487-514) - tests error categorization strategies
5. **Type safety validation** (L516-531) - ensures enum constraint integrity

## Testing Patterns

- **Comprehensive Coverage**: Tests 40+ interface properties and enum values across the entire debug adapter contract
- **Type Safety Focus**: Validates enum constraints and interface compliance to ensure robust type checking
- **Error Scenario Testing**: Covers both positive validation cases and error recovery patterns
- **Modular Organization**: Uses describe/it structure for organized validation of related functionality

This test directory serves as the validation layer ensuring the debug adapter interface contract remains stable and type-safe across the MCP ecosystem.