# tests\adapters\javascript\integration/
@children-hash: f92840aeda20328e
@generated: 2026-02-15T09:01:20Z

## Purpose and Responsibility

This directory contains integration smoke tests for JavaScript/TypeScript adapter functionality within the debugger system. It validates the end-to-end integration between the adapter registry, JavaScript adapter factory, and the underlying js-debug runtime, focusing on session management, launch configuration transformation, and adapter command generation.

## Key Components

### Integration Test Suite (`javascript-session-smoke.test.ts`)
The primary test file that validates core JavaScript adapter integration points:
- **Session Configuration**: Tests adapter setup with TypeScript-specific configurations and cross-platform path handling
- **Launch Config Transformation**: Validates runtime executable overrides (tsx) and parameter handling
- **Adapter Command Building**: Ensures proper command generation with correct paths and port configuration

### Cross-Platform Support
- Platform-specific path normalization utilities for Windows vs Unix environments
- Environment variable preservation patterns for test isolation
- Path handling that works consistently across different operating systems

### Test Infrastructure
- Vitest-based testing framework with proper setup/teardown lifecycle
- Mock management for adapter registry components
- Session isolation using unique identifiers (`session-js-3`)

## Public API Surface

### Main Entry Points
- **Integration validation** for JavaScript adapter factory registration
- **Launch configuration testing** with TypeScript/tsx runtime support
- **Command building verification** for js-debug adapter integration

### Key Interfaces
- Integration with `adapter-registry` system for adapter management
- Interaction with `JavascriptAdapterFactory` for TypeScript/JavaScript debugging
- Validation of `js-debug/vsDebugServer.cjs` adapter command generation

## Internal Organization and Data Flow

1. **Test Setup**: Environment preservation, registry initialization, and mock configuration
2. **Adapter Registration**: Factory registration with validation disabled for testing
3. **Configuration Testing**: Launch config transformation with runtime overrides
4. **Command Validation**: End-to-end command building and path verification
5. **Cleanup**: Environment restoration and mock reset

## Important Patterns and Conventions

- **Smoke Testing Approach**: Focuses on critical integration points rather than exhaustive coverage
- **Environment Isolation**: Preserves and restores NODE_OPTIONS for clean test execution
- **Cross-Platform Compatibility**: Normalizes paths and handles platform differences
- **Type Flexibility**: Uses type assertions for adapter interface compatibility
- **Port Configuration**: Standardized adapter host/port setup (localhost:56789)

This directory serves as the integration validation layer ensuring that JavaScript/TypeScript debugging adapters work correctly within the broader debugger architecture, with particular attention to TypeScript toolchain integration via tsx runtime.