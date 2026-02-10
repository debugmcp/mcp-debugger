# tests/core/unit/adapters/debug-adapter-interface.test.ts
@source-hash: 2b0fb6075a0819cf
@generated: 2026-02-09T18:14:19Z

## Primary Purpose
Unit test suite for debug adapter interface types from `@debugmcp/shared`. Validates enums, error classes, and TypeScript interfaces used in debug adapter protocol implementation.

## Test Structure
- **AdapterState enum tests (L26-41)**: Validates 7 adapter lifecycle states (uninitialized → ready → debugging → error)
- **AdapterErrorCode enum tests (L43-76)**: Validates 13 categorized error codes (environment, connection, protocol, runtime)
- **DebugFeature enum tests (L78-106)**: Validates 20 debug protocol features (breakpoints, variable inspection, etc.)
- **AdapterError class tests (L108-141)**: Tests custom error class with code, message, and recoverable flag
- **Type interface tests (L143-485)**: Comprehensive validation of TypeScript interfaces

## Key Test Categories

### Core Error Handling (L108-141, L487-514)
- `AdapterError` class extends native Error with `code` and `recoverable` properties
- Tests error instantiation, inheritance, stack traces, and recovery patterns
- Validates proper error categorization for different failure scenarios

### Validation Types (L144-191)
- `ValidationResult` interface with errors/warnings arrays
- `ValidationError` and `ValidationWarning` structures with codes and messages
- Tests both successful and failed validation scenarios

### Configuration Types (L193-330)
- `DependencyInfo` (L193-217): Package dependencies with version requirements
- `AdapterCommand` (L219-245): Command execution with args and environment
- `AdapterConfig` (L247-286): Complete adapter configuration including session, paths, ports
- `GenericLaunchConfig` & `LanguageSpecificLaunchConfig` (L288-330): Debug launch parameters

### Feature Requirements (L333-367)
- `FeatureRequirement` interface supporting dependency/version/configuration requirement types
- Tests requirement validation for debug adapter capabilities

### Adapter Capabilities (L369-456)
- `AdapterCapabilities` interface with 30+ boolean capability flags
- `ExceptionBreakpointFilter` for exception handling configuration
- Extensive testing of DAP (Debug Adapter Protocol) feature support

## Dependencies
- **vitest**: Test framework (describe, it, expect, beforeEach)
- **@debugmcp/shared**: Core types being tested (all imported types L6-23)
- **DebugLanguage**: Additional enum import (L23)

## Test Patterns
- Enum value validation with string literal checking
- Interface instantiation and property validation  
- Type safety enforcement through TypeScript compilation
- Error class behavior validation including inheritance chains
- Comprehensive coverage of optional vs required fields