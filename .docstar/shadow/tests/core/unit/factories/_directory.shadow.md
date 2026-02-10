# tests/core/unit/factories/
@generated: 2026-02-10T01:19:39Z

## Overview
Unit test suite for factory pattern implementations in the core debug system, providing comprehensive validation of factory classes that create debug proxy managers and session stores. This directory ensures proper implementation of dependency injection, mock testing utilities, and factory pattern compliance.

## Test Coverage

### Core Factory Components
- **ProxyManagerFactory**: Production factory for creating ProxyManager instances with optional debug adapter injection
- **MockProxyManagerFactory**: Test utility factory with state tracking capabilities for test introspection
- **SessionStoreFactory**: Production factory for creating SessionStore instances for debug session management
- **MockSessionStoreFactory**: Test utility factory that creates MockSessionStore instances with call tracking
- **MockSessionStore**: Enhanced session store with method invocation tracking for test validation

### Key Testing Patterns

**Factory Pattern Validation:**
- Instance creation and type verification
- Instance independence and isolation testing
- Statelessness verification for production factories
- Interface compliance and method signature validation

**Mock Testing Infrastructure:**
- State tracking for created instances in mock factories
- Parameter capture and call history maintenance
- Error resilience and edge case handling
- Independent test instance isolation

**Dependency Injection Testing:**
- Optional parameter handling (debug adapters, session parameters)
- Dependency integrity across factory calls
- Adapter tracking and parameter passing verification

## Public API Surface

### Test Entry Points
- `proxy-manager-factory.test.ts`: Tests for ProxyManagerFactory and MockProxyManagerFactory
- `session-store-factory.test.ts`: Tests for SessionStoreFactory, MockSessionStoreFactory, and MockSessionStore

### Key Test Utilities
- **Mock Helper Functions**: `createMockDebugAdapter()` - comprehensive IDebugAdapter mock creation
- **Test Setup/Teardown**: Standard Vitest lifecycle management with mock clearing
- **State Tracking**: Arrays for monitoring created instances and method calls in mock implementations

## Internal Organization

### Test Structure
Each test file follows consistent patterns:
1. **Dependencies and Imports**: Framework setup and class imports
2. **Mock Utilities**: Helper functions for creating test doubles
3. **Production Factory Tests**: Core functionality and interface compliance
4. **Mock Factory Tests**: State tracking and test utility validation
5. **Integration Tests**: End-to-end factory behavior with realistic scenarios

### Data Flow
1. **Factory Creation**: Tests instantiate factories with proper dependencies
2. **Instance Generation**: Factories create manager/store instances with dependency injection
3. **State Verification**: Mock factories track creation history and parameters
4. **Isolation Testing**: Ensures independent operation of multiple instances
5. **Interface Validation**: Confirms compliance with expected contracts

## Important Patterns

**Factory Pattern Implementation:**
- Stateless production factories with consistent instance creation
- Mock factories with enhanced state tracking for test verification
- Dependency injection support with optional parameters

**Test Architecture:**
- Comprehensive mock utilities for external dependencies
- Parameter preservation and deep equality validation
- Instance independence verification across multiple factory calls
- Error handling and edge case coverage

**Mock System Integration:**
- Real functionality preservation in mock implementations
- Call history tracking without behavior modification
- State isolation between separate mock instances

This test directory serves as the validation layer for the factory pattern implementation in the debug system, ensuring reliable instance creation, proper dependency management, and robust mock testing capabilities for the broader application architecture.