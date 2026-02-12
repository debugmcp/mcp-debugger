# packages\adapter-mock\tests/
@generated: 2026-02-12T21:05:56Z

## Test Suite for Mock Debug Adapter Package

**Overall Purpose:** This directory contains the complete test suite for the mock debug adapter package, providing comprehensive validation of both the factory pattern implementation and the core mock adapter functionality. The tests ensure the mock adapter serves as reliable testing infrastructure for the debug MCP system while properly adhering to adapter interface contracts.

**Key Components & Organization:**

### Primary Test Files
- **`mock-adapter.test.ts`**: Package-level integration tests validating exports and basic factory functionality
- **`unit/`**: Comprehensive unit test suite with detailed validation of factory and adapter implementations
  - **Factory Tests**: Configuration handling, metadata generation, and validation logic
  - **Adapter Tests**: Lifecycle management, state transitions, and error scenario simulation

### Testing Architecture

**Multi-Layer Validation:**
- **Package Integration Level**: Verifies proper exports (`MockAdapterFactory`, `MockDebugAdapter`) and basic factory instantiation
- **Unit Level**: Deep validation of configuration handling, lifecycle management, state transitions, and error scenarios
- **Feature Coverage**: Tests adapter feature support, metadata generation, and configuration validation

**Common Test Infrastructure:**
- Shared `createDependencies()` helper functions across test files for consistent mock setup
- Vitest framework integration with spy functions and async testing patterns
- Mock AdapterDependencies with spy loggers for isolated testing

### Public API Testing Surface

**Factory Pattern Validation:**
- `MockAdapterFactory` constructor and configuration handling
- `createMockAdapterFactory()` helper function behavior
- Metadata generation (language type, display name, version, extensions)
- Configuration validation with warning generation

**Adapter Lifecycle Testing:**
- State management (INITIALIZING → READY → CONNECTED → DEBUGGING)
- Connection/disconnection flows with proper cleanup
- Thread ID tracking and context management
- Event emission and listener integration

**Error Scenario Coverage:**
- Mock error scenario handling using `MockErrorScenario` enum
- Error code translation and message formatting
- State management during error conditions
- Connection timeout and executable not found scenarios

### Internal Organization & Data Flow

The test suite follows a hierarchical validation approach:
1. **Package-level smoke tests** ensure basic exports and instantiation work
2. **Factory unit tests** validate configuration processing and adapter creation
3. **Adapter unit tests** provide comprehensive lifecycle and error scenario coverage

Tests utilize consistent patterns for dependency injection, state validation through event listeners, and async lifecycle method testing. The mock adapter serves as both a testing utility and a reference implementation for the debug adapter interface.

### Dependencies & Integration Points

**External Dependencies:**
- **Vitest**: Primary testing framework providing spy utilities and assertion capabilities
- **@debugmcp/shared**: Core types and interfaces for adapter contracts

**Internal Validation:**
- Factory pattern implementation testing
- Adapter interface compliance verification
- Configuration validation and error handling
- Feature support and metadata generation testing

This test directory ensures the mock adapter package provides reliable, well-tested infrastructure for development and testing scenarios within the broader debug MCP ecosystem.