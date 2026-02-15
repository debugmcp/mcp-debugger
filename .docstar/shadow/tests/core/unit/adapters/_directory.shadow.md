# tests\core\unit\adapters/
@children-hash: 8b0c0341ac9f1c84
@generated: 2026-02-15T09:01:20Z

## Overview

The `tests/core/unit/adapters` directory contains comprehensive unit tests that validate the debug adapter interface contracts defined in the @debugmcp/shared package. This test suite serves as both quality assurance and living documentation for the debug adapter protocol implementation.

## Purpose and Scope

This directory focuses exclusively on testing the foundational types, enums, and interfaces that define how debug adapters communicate within the DebugMCP system. It validates:

- **Protocol Contracts**: Ensures all debug adapter interface definitions are properly structured and type-safe
- **State Management**: Validates adapter lifecycle states and transitions
- **Error Handling**: Tests comprehensive error categorization and recovery mechanisms
- **Feature Coverage**: Verifies support for 20+ debug protocol features across different language adapters

## Key Components

### Core Test Suite: debug-adapter-interface.test.ts
- **Enum Validation**: Tests critical enums including AdapterState (7 lifecycle states), AdapterErrorCode (13 error categories), and DebugFeature (20+ protocol features)
- **Type Interface Testing**: Comprehensive validation of 8+ complex interfaces covering configuration, capabilities, validation, and dependency management
- **Error Class Testing**: Validates custom AdapterError class with proper code categorization and recovery flags
- **Type Safety Enforcement**: Ensures enum constraints and interface contracts are properly enforced

## Testing Architecture

The test suite follows a structured approach:

1. **Enum Testing Pattern**: Validates each enum value exists and has correct typing
2. **Interface Validation**: Tests complex nested objects with required/optional properties
3. **Error Scenario Coverage**: Tests both success and failure paths for error handling
4. **Type Constraint Verification**: Ensures compile-time and runtime type safety

## Coverage Areas

- **Adapter Lifecycle**: uninitialized → ready → debugging → error state transitions
- **Error Categories**: Environment, connection, protocol, and runtime errors
- **Debug Features**: Breakpoints, variable inspection, step debugging, exception handling
- **Configuration Management**: Launch configs, adapter capabilities, dependency requirements
- **Protocol Compliance**: Validation of debug protocol feature support across adapters

## Quality Assurance Role

This test directory serves as the contract validation layer, ensuring that:
- All debug adapter implementations conform to shared interface definitions  
- Type safety is maintained across the debug protocol
- Error handling follows consistent patterns
- New features are properly integrated into the type system

The tests act as a safety net for the broader DebugMCP system, catching interface violations and ensuring consistent behavior across different debug adapter implementations.