# packages/adapter-mock/tests/unit/
@generated: 2026-02-11T23:47:36Z

## Mock Adapter Unit Tests Directory

This directory contains comprehensive unit tests for the mock debug adapter implementation, providing validation for both the adapter factory pattern and the core adapter functionality.

## Overall Purpose

The test suite validates the complete mock debug adapter system, ensuring proper:
- Factory-based adapter creation and configuration
- Adapter lifecycle management (initialization, connection, debugging states)
- Error scenario simulation and handling
- Feature support configuration and reporting
- DAP (Debug Adapter Protocol) event processing

## Key Test Components

### Factory Testing (`mock-adapter-factory.test.ts`)
- **MockAdapterFactory Creation**: Validates proper instantiation with custom configuration (supportedFeatures, defaultDelay)
- **Metadata Validation**: Tests adapter metadata including language type, display name, version, and file extensions
- **Configuration Validation**: Tests validation logic with warnings for high error probability (>0.8) and excessive delays (>2500ms)
- **Helper Function**: Validates `createMockAdapterFactory` convenience function

### Adapter Implementation Testing (`mock-debug-adapter.spec.ts`)
- **State Management**: Tests complete state transition flows (INITIALIZING → READY → CONNECTED → DEBUGGING)
- **Connection Lifecycle**: Validates connect/disconnect cycles with proper cleanup
- **Error Scenarios**: Tests configurable error simulation using `MockErrorScenario` enum
- **DAP Event Handling**: Validates processing of 'stopped' and 'terminated' debug events
- **Feature Support**: Tests dynamic feature enabling/disabling and requirements reporting

## Test Infrastructure

### Mock Dependencies Pattern
Both test files use a shared pattern for creating mock dependencies:
- **`createDependencies()` functions**: Create mock AdapterDependencies with stubbed file system, process launcher, environment, and logger interfaces
- **Spy Integration**: Uses Vitest spy functions for logger validation and call tracking
- **Type Extension**: Extends mock interfaces to include additional testing methods

### Common Test Patterns
- **State Transition Validation**: Event listeners track adapter state changes
- **Error Scenario Simulation**: Configurable error injection for negative testing
- **Async/Await Patterns**: Proper handling of adapter lifecycle methods
- **Mock Dependency Injection**: Isolated testing through dependency mocking

## Public Testing API

The tests validate the complete public interface:
- **Factory Interface**: `MockAdapterFactory` constructor and `createMockAdapterFactory` helper
- **Adapter Interface**: Standard debug adapter lifecycle methods (initialize, connect, disconnect)
- **Event System**: DAP event handling and state change notifications
- **Feature System**: Dynamic feature support querying and configuration

## Integration with Broader System

These tests ensure the mock adapter properly implements the shared debug adapter interfaces from `@debugmcp/shared`, validating compatibility with the broader debug adapter ecosystem while providing reliable test doubles for development and testing scenarios.