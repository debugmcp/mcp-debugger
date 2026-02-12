# packages\adapter-mock\tests\unit/
@generated: 2026-02-12T21:00:52Z

## Mock Adapter Unit Test Suite

**Purpose:** Comprehensive unit test directory for the Mock Debug Adapter implementation, validating both factory creation patterns and core adapter functionality through isolated test scenarios.

**Key Components:**

### Factory Testing (`mock-adapter-factory.test.ts`)
- **MockAdapterFactory Creation & Configuration:** Tests factory instantiation with custom settings (supportedFeatures, defaultDelay) and feature flag handling
- **Metadata Validation:** Verifies correct adapter metadata (language type, display name, version, extensions)
- **Configuration Validation:** Tests validation logic including warning generation for high error probabilities (>0.8) and excessive delays (>2500ms)
- **Helper Function Testing:** Validates `createMockAdapterFactory` convenience function

### Core Adapter Testing (`mock-debug-adapter.spec.ts`)
- **Initialization & State Management:** Tests adapter lifecycle with state transitions (INITIALIZING → READY) and error scenarios
- **Connection Management:** Validates connect/disconnect cycles with proper state handling and timeout scenarios
- **DAP Event Processing:** Tests debug event handling ('stopped', 'terminated') with thread ID tracking and state transitions
- **Feature Support:** Validates feature reporting and requirement querying based on configuration
- **Error Translation:** Tests mock-specific error messaging and installation instructions

**Public API Surface:**
- MockAdapterFactory class constructor and validation methods
- `createMockAdapterFactory()` helper function for simplified factory creation
- MockDebugAdapter lifecycle methods: `initialize()`, `connect()`, `disconnect()`, `handleDapEvent()`
- Feature support methods: `supportsFeature()`, `getFeatureRequirements()`

**Internal Organization:**
- **Test Utilities:** Shared `createDependencies()` helper creates mock AdapterDependencies with spy loggers
- **State Validation:** Tests use event listeners to validate proper state transitions
- **Error Simulation:** MockErrorScenario enum enables testing various failure modes
- **Configuration Testing:** Validation tests ensure proper warning generation for performance-impacting settings

**Testing Patterns:**
- Mock dependency injection for isolated unit testing
- State transition validation through event-driven testing
- Error scenario simulation using configurable mock behaviors
- Async/await patterns for adapter lifecycle testing
- Type casting strategies for mock object creation

**Dependencies:**
- **Vitest:** Primary testing framework with spy and assertion utilities
- **@debugmcp/shared:** Core adapter types and interfaces (AdapterDependencies, DebugFeature, AdapterState)
- **Local Mock Implementation:** MockAdapterFactory and MockDebugAdapter classes under test

This test suite ensures the mock adapter implementation properly handles all expected scenarios while providing a reliable foundation for development and testing workflows involving debug adapter protocols.