# tests/unit/adapters/
@generated: 2026-02-10T01:19:40Z

## Unit Test Suite for Debug Adapters Module

**Primary Purpose**: Comprehensive unit test suite validating the debug adapter system's core components including dynamic loading, registration, lifecycle management, and implementation-specific behaviors for different debug adapter types.

## Test Coverage Overview

This directory contains unit tests for the complete debug adapter ecosystem, ensuring reliable dynamic loading, proper state management, and correct behavior across multiple adapter implementations.

### Core System Components

**AdapterLoader Testing** (`adapter-loader.test.ts`):
- Dynamic module loading with fallback strategies (node_modules, packages, createRequire)
- Adapter package resolution and caching mechanisms
- Availability detection and metadata retrieval for all supported languages (Python, JavaScript, Rust, Go, C++, Mock)
- Error handling for missing packages with helpful installation guidance

**AdapterRegistry Testing** (`adapter-registry.test.ts`):
- Factory registration and validation with duplicate prevention
- Adapter lifecycle management (creation, disposal, cleanup)
- Instance limits enforcement per language type
- Dynamic loading integration and auto-disposal mechanisms
- Bulk operations for registry cleanup

### Implementation-Specific Testing

**JavaScript Adapter Testing** (`javascript-debug-adapter.test.ts`):
- TypeScript runtime integration and argument deduplication
- Node.js error translation and feature support validation
- Launch barrier coordination for DAP communication
- Runtime helper processing and configuration transformation

**Mock Adapter Testing** (`mock-debug-adapter.test.ts`):
- State transition validation (READY → CONNECTED → DISCONNECTED)
- Feature support reporting and error message translation
- Error scenario injection for testing failure conditions
- Mock debugging behavior verification

### Utility Testing

**Launch Barrier Testing** (`js-debug-launch-barrier.test.ts`):
- DAP event-based readiness detection ('stopped', 'adapter_connected')
- Timeout handling and fallback mechanisms
- Proxy exit error handling and duplicate signal prevention
- Async coordination for JavaScript debugging sessions

## Key Testing Patterns

**Mocking Strategy**:
- Comprehensive vitest mocking for external dependencies (ModuleLoader, createRequire, loggers)
- Factory pattern for creating standardized test fixtures
- Isolation through cache clearing and fresh mock creation

**Error Scenario Coverage**:
- Module loading failures with appropriate fallback testing
- Network and filesystem error translation validation
- Timeout and connection failure simulation
- Proper error propagation and user-friendly messaging

**State Management Validation**:
- Adapter lifecycle state transitions
- Cache behavior and persistence testing
- Resource cleanup and disposal verification
- Configuration-driven behavior validation

## Dependencies and Integration

**External Dependencies**:
- Vitest testing framework with comprehensive mocking capabilities
- @debugmcp/shared package for common types and error classes
- Individual adapter packages (adapter-python, adapter-javascript, adapter-mock)

**Internal Coordination**:
- Tests validate integration between AdapterLoader and AdapterRegistry
- Launch barrier coordination with DAP protocol events
- Feature detection and support matrix validation across adapter types

## API Surface Validation

**Public Methods Tested**:
- `loadAdapter()`, `isAdapterAvailable()`, `listAvailableAdapters()` (AdapterLoader)
- `register()`, `createAdapter()`, `disposeAll()` (AdapterRegistry)
- `initialize()`, `connect()`, `disconnect()`, `supportsFeature()` (Adapters)
- `waitUntilReady()`, `dispose()` (Launch utilities)

**Configuration Testing**:
- Dynamic loading enablement/disabling
- Auto-disposal timeout configuration
- Maximum instances per language enforcement
- Feature support matrix validation

This test suite ensures the debug adapter system maintains reliability and correctness across all supported programming languages and debugging scenarios, with particular focus on error resilience and proper resource management.