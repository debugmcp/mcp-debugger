# packages/adapter-mock/tests/unit/
@generated: 2026-02-10T21:26:15Z

## Unit Test Suite for Mock Debug Adapter

**Overall Purpose:**
This directory contains comprehensive unit tests for the MockDebugAdapter system, providing complete test coverage for both the adapter implementation and its factory. The tests validate the mock debugging infrastructure used for development, testing, and demonstration purposes within the debug adapter ecosystem.

**Key Components & Organization:**

- **`mock-debug-adapter.spec.ts`:** Core adapter functionality tests covering the complete adapter lifecycle including initialization, connection management, DAP event handling, feature support, and error scenarios. Tests state transitions, thread tracking, and configurable error simulation.

- **`mock-adapter-factory.test.ts`:** Factory pattern tests validating adapter creation, metadata exposure, configuration validation, and warning systems. Tests both direct factory usage and convenience helper functions.

**Test Infrastructure:**
Both test files utilize a shared `createDependencies()` pattern that creates mock AdapterDependencies objects with stubbed file system, process launcher, environment, and logger interfaces. This provides consistent dependency injection for isolated testing.

**Public API Coverage:**

**MockDebugAdapter Interface:**
- Lifecycle methods: `initialize()`, `connect()`, `disconnect()`
- Event handling: `handleDapEvent()` for DAP protocol events
- Feature support: `supportsFeature()`, `getFeatureRequirements()`
- Error translation: Installation instructions and filesystem error mapping
- State management: INITIALIZING → READY → CONNECTED → DEBUGGING transitions

**MockAdapterFactory Interface:**
- Adapter creation with custom configuration (supportedFeatures, defaultDelay, errorProbability)
- Metadata retrieval: language type, display name, version, extensions
- Configuration validation with warning system for performance thresholds
- Helper function: `createMockAdapterFactory()` convenience method

**Test Patterns & Conventions:**
- State transition validation through event listeners and async/await patterns
- Error scenario simulation using MockErrorScenario enumeration
- Mock dependency injection with Vitest spy functions for logging verification
- Configuration boundary testing for validation warnings (errorProbability > 0.8, defaultDelay > 2500ms)
- Interface compliance testing ensuring proper type satisfaction

**Integration Points:**
The tests validate integration with the broader debug adapter system through shared types from `@debugmcp/shared` including AdapterDependencies, DebugFeature, DebugLanguage, AdapterState, and AdapterErrorCode. This ensures the mock adapter properly implements the standard debug adapter interface while providing configurable behavior for testing scenarios.

**Quality Assurance:**
Tests cover both positive functionality and error conditions, including connection timeouts, executable not found scenarios, and configuration validation warnings. The comprehensive coverage ensures the mock adapter can reliably simulate various debugging scenarios for development and testing purposes.