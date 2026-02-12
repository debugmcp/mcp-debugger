# tests\unit\container/
@generated: 2026-02-12T21:00:50Z

## Purpose
This directory contains unit tests for the dependency injection container system, specifically testing the production dependency factory that wires together the core MCP application services and manages adapter registration.

## Key Components
The test suite focuses on validating the `createProductionDependencies` factory function through comprehensive mocking and integration testing:

- **Mock Infrastructure**: Extensive mock system covering all core services (filesystem, process manager, network manager, launcher), logging infrastructure, service implementations, factories, and adapter registry
- **Environment Management**: Test utilities for managing process environment state and global bundled adapter configurations
- **Container Validation**: Tests that verify proper dependency injection wiring and service instantiation

## Test Coverage Areas
1. **Core Service Wiring**: Validates that the dependency injection container correctly instantiates and connects all core services with proper logger configuration and adapter registry setup
2. **Adapter Registration**: Tests asynchronous bundled adapter registration process with error handling, using global state management for adapter configurations
3. **Environment-Aware Filtering**: Verifies container behavior in different environments (MCP_CONTAINER=true) with conditional adapter loading based on language configuration

## Critical Testing Patterns
- **Isolation Strategy**: Each test maintains complete isolation through comprehensive mock resets and environment restoration
- **Async Error Testing**: Validates error handling in adapter registration using Promise timing patterns
- **Global State Management**: Tests interaction with global bundled adapter configurations via `__DEBUG_MCP_BUNDLED_ADAPTERS__` key
- **Environment Simulation**: Tests different deployment scenarios through process.env manipulation

## Public API Validation
The tests focus on the main entry point - the `createProductionDependencies` factory function - ensuring it:
- Returns a properly configured dependency container
- Handles bundled adapter registration correctly
- Responds appropriately to environment-specific configurations
- Maintains error resilience during startup

This test directory serves as the validation layer for the application's dependency injection system, ensuring reliable service wiring and adapter management across different deployment environments.