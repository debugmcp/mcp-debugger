# tests\unit\adapters/
@generated: 2026-02-12T21:05:42Z

## Overall Purpose

This directory contains comprehensive unit tests for the debugMCP adapter system's core components, validating dynamic adapter loading, registration, lifecycle management, and language-specific adapter implementations. The test suite ensures robust adapter management, error handling, and feature support across multiple programming language adapters.

## Key Components and Relationships

### Core Infrastructure Tests
- **AdapterLoader Tests** (`adapter-loader.test.ts`): Tests dynamic module loading with 3-tier fallback system, caching mechanisms, and adapter availability detection
- **AdapterRegistry Tests** (`adapter-registry.test.ts`): Validates adapter factory registration, instance lifecycle management, dynamic loading coordination, and bulk operations

### Language-Specific Adapter Tests
- **JavaScript Adapter** (`javascript-debug-adapter.test.ts`): Tests error translation, feature support detection, and launch coordination barriers
- **Mock Adapter** (`mock-debug-adapter.test.ts`): Validates state transitions, feature configuration, and error scenario injection for testing purposes

### Specialized Utility Tests
- **Launch Barrier** (`js-debug-launch-barrier.test.ts`): Tests JavaScript-specific launch readiness detection and DAP event coordination

## Test Architecture Patterns

### Common Testing Utilities
- Mock factories for dependencies (logger, filesystem, environment, process launcher)
- Vitest framework with comprehensive mocking and fake timer support
- Event-driven testing for adapter state management and DAP coordination
- Error simulation with custom error codes and scenarios

### Test Coverage Areas
- **Dynamic Loading**: Module resolution, fallback mechanisms, and caching behavior
- **Lifecycle Management**: Registration, creation, disposal, and cleanup operations  
- **Feature Support**: Conditional breakpoints, log points, data breakpoints, and evaluation capabilities
- **Error Handling**: Translation of system errors to user-friendly messages
- **State Management**: Adapter state transitions and event coordination

## Key Entry Points and API

### Primary Classes Under Test
- `AdapterLoader`: Dynamic module loading and adapter discovery
- `AdapterRegistry`: Central registry for adapter factory management
- `JavascriptDebugAdapter`: JavaScript-specific debugging implementation
- `MockDebugAdapter`: Testing adapter with configurable behaviors
- `JsDebugLaunchBarrier`: Launch coordination utility for JavaScript debugging

### Critical Behaviors Validated
- Adapter availability checking and metadata enumeration
- Factory validation and duplicate registration prevention
- Maximum instance limits and auto-disposal mechanisms
- Launch barrier coordination with DAP event handling
- Error scenario injection for testing edge cases

## Internal Organization

The tests follow a hierarchical structure where infrastructure components (AdapterLoader, AdapterRegistry) provide the foundation for language-specific adapters (JavaScript, Mock) and specialized utilities (Launch Barriers). Each test file maintains isolation through comprehensive mocking while validating integration points and public API contracts.

The test suite emphasizes behavioral validation over implementation details, ensuring the adapter system maintains reliability across dynamic loading scenarios, multi-language support, and complex debugging workflows.