# tests/core/unit/adapters/
@generated: 2026-02-09T18:16:06Z

## Overview
This directory contains unit tests for the debug adapter interface types and protocol definitions from the `@debugmcp/shared` package. It serves as the validation layer for all TypeScript types, enums, and error classes that define the Debug Adapter Protocol (DAP) implementation within the MCP debug system.

## Purpose and Responsibility
The test suite ensures type safety and contract validation for the core debug adapter interfaces. It validates the complete type system that governs communication between debug clients and adapters, covering:
- Adapter lifecycle state management
- Error classification and handling patterns
- Debug protocol feature definitions
- Configuration and capability negotiation
- Validation result structures

## Key Components

### Type System Validation
- **Enum Testing**: Validates `AdapterState`, `AdapterErrorCode`, and `DebugFeature` enums for correct values and type safety
- **Interface Testing**: Comprehensive validation of all TypeScript interfaces used in the debug protocol
- **Error Class Testing**: Validates custom `AdapterError` class with proper inheritance and categorization

### Core Test Categories
1. **Lifecycle Management**: Tests adapter state transitions (uninitialized → ready → debugging → error)
2. **Error Handling**: Validates 13 categorized error codes and custom error class behavior
3. **Feature Detection**: Tests 20+ debug protocol features for capability negotiation
4. **Configuration Validation**: Tests adapter configuration, launch configs, and dependency management
5. **Protocol Compliance**: Ensures DAP specification adherence through interface validation

### Configuration and Capabilities
- **AdapterConfig**: Complete adapter setup including sessions, paths, and ports
- **LaunchConfig**: Generic and language-specific debug session parameters  
- **AdapterCapabilities**: 30+ boolean flags for DAP feature support
- **DependencyInfo**: Package dependency validation with version requirements

## Public API Surface
The tests validate the public interface contracts for:
- **State Management**: `AdapterState` enum and state transition patterns
- **Error Classification**: `AdapterErrorCode` enum and `AdapterError` class
- **Feature Negotiation**: `DebugFeature` enum and `AdapterCapabilities` interface
- **Configuration**: `AdapterConfig`, `GenericLaunchConfig`, and validation structures
- **Type Safety**: All TypeScript interfaces ensuring compile-time contract enforcement

## Internal Organization
Tests are organized by logical groupings:
1. Enum validations (state, errors, features)
2. Error class behavior testing
3. Configuration type validation
4. Capability and feature requirement testing
5. Validation result structure testing

## Testing Patterns
- **Type Safety**: Leverages TypeScript compilation for interface validation
- **Value Validation**: Explicit checking of enum values and object properties
- **Inheritance Testing**: Validates error class extends native Error properly
- **Contract Enforcement**: Ensures required vs optional field compliance
- **Edge Case Coverage**: Tests both success and failure scenarios

## Dependencies
- **vitest**: Primary testing framework
- **@debugmcp/shared**: Source of all types being validated
- **TypeScript**: Compile-time type checking integration

This test directory serves as the foundation for type safety across the entire MCP debug system, ensuring all debug adapter implementations conform to the established protocol contracts.