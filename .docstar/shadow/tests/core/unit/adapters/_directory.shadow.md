# tests/core/unit/adapters/
@generated: 2026-02-10T21:26:26Z

## Overview

The `tests/core/unit/adapters` directory contains comprehensive unit tests for the debug adapter interface components from the `@debugmcp/shared` package. This test suite serves as both validation and documentation for the foundational types, enums, and error handling patterns that power the debug adapter system.

## Purpose and Responsibility

This module validates the complete debug adapter interface specification through exhaustive unit testing, ensuring:
- **Type safety and contract validation** for all debug adapter interfaces
- **Enum completeness and correctness** across adapter states, error codes, and feature flags
- **Error handling robustness** through custom error class validation
- **API consistency** between shared types and their implementations

## Key Components

### Core Enums Validation
- **AdapterState** (7 states): Tests complete adapter lifecycle from uninitialized through ready, debugging, and error states
- **AdapterErrorCode** (13 codes): Validates error categorization across environment, connection, protocol, and runtime failures
- **DebugFeature** (20 features): Tests debug protocol capability flags including breakpoints, variable inspection, and step debugging

### Type Interface Testing
- **Configuration Types**: Validates `AdapterConfig`, `GenericLaunchConfig`, and language-specific launch configurations
- **Capability Definitions**: Tests `AdapterCapabilities` with extensive feature flags and protocol support
- **Validation Framework**: Tests `ValidationResult` for error/warning collection and `DependencyInfo` for version requirements
- **Command Execution**: Validates `AdapterCommand` structure for environment and execution configuration

### Error Handling Validation
- **AdapterError Class**: Tests custom error implementation with categorization and recovery flag support
- **Error Recovery Patterns**: Validates different error types and their associated recovery strategies
- **Exception Filtering**: Tests `ExceptionBreakpointFilter` for debugger exception handling configuration

## Testing Architecture

The test suite employs a systematic approach:
- **Describe/it structure** for organized validation of each component type
- **Positive and negative test cases** ensuring both valid usage and error conditions
- **Type safety validation** confirming enum constraints and interface completeness
- **40+ interface properties** tested across all major adapter configuration objects

## Integration Points

This test module serves as the validation layer for:
- **Shared type definitions** used across the debug adapter ecosystem
- **Protocol compliance** ensuring adapter implementations meet specification requirements  
- **Error handling contracts** that adapters must implement for proper error reporting and recovery
- **Configuration validation** for debug session setup and capability negotiation

## Dependencies

- **vitest**: Testing framework providing describe/it structure and assertion capabilities
- **@debugmcp/shared**: Source package containing all validated types, enums, and error classes

The test suite acts as a comprehensive specification validator, ensuring the debug adapter interface maintains consistency and type safety across the entire debug protocol implementation.