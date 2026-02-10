# tests/core/unit/adapters/
@generated: 2026-02-10T01:19:36Z

## Purpose

The `tests/core/unit/adapters` directory contains comprehensive unit tests for the debug adapter interface components. This directory validates the foundational types, enums, error classes, and interfaces that define the contract between the DebugMCP system and various language-specific debug adapters.

## Key Components

### Debug Adapter Interface Test Suite (`debug-adapter-interface.test.ts`)
- **Enum Validation**: Tests 3 critical enums that govern adapter behavior:
  - `AdapterState` (7 lifecycle states): Validates state transitions from initialization through debugging
  - `AdapterErrorCode` (13 error types): Categorizes errors across environment, connection, protocol, and runtime domains
  - `DebugFeature` (20 capabilities): Validates support for debug protocol features like breakpoints, variable inspection, and step debugging

- **Error Class Testing**: Validates the `AdapterError` custom exception class with proper error categorization and recovery flag handling

- **Type Interface Validation**: Comprehensive testing of 8 core interfaces:
  - Configuration types: `AdapterConfig`, `GenericLaunchConfig`, `LanguageSpecificLaunchConfig`
  - Runtime types: `ValidationResult`, `DependencyInfo`, `AdapterCommand`
  - Capability types: `AdapterCapabilities`, `FeatureRequirement`, `ExceptionBreakpointFilter`

## Public API Surface

The tests validate the public contract for:
- **Adapter lifecycle management** through state enums and error codes
- **Configuration validation** via config interfaces and validation result types
- **Feature detection** through capability flags and requirement specifications
- **Error handling** via categorized error codes and recovery strategies

## Internal Organization

### Testing Architecture
- Uses vitest framework with describe/it structure for organized test suites
- Validates 40+ interface properties and enum values with both positive and negative cases
- Tests type safety and enum value constraints

### Data Flow Validation
The tests ensure proper data flow patterns:
1. **Configuration → Validation**: Config interfaces feed into validation result types
2. **Capabilities → Features**: Adapter capabilities map to specific debug features
3. **Errors → Recovery**: Error categorization enables appropriate recovery strategies
4. **State → Lifecycle**: State enums govern adapter lifecycle transitions

## Dependencies

- **@debugmcp/shared**: Source package providing all tested types, enums, and interfaces
- **vitest**: Testing framework for unit test execution
- Validates the complete adapter interface contract used across the DebugMCP ecosystem

## Patterns and Conventions

- **Comprehensive enum testing**: Each enum value is explicitly validated
- **Interface property validation**: All required and optional properties are tested
- **Error categorization**: Systematic testing of error types with recovery flags
- **Type safety enforcement**: Ensures proper TypeScript type constraints are maintained

This test suite serves as the authoritative validation of the debug adapter interface contract, ensuring compatibility and reliability across all debug adapter implementations in the DebugMCP system.