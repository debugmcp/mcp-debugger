# tests/unit/adapter-python/
@generated: 2026-02-10T21:26:14Z

## Python Debug Adapter Test Suite

This directory contains comprehensive unit tests for the Python debug adapter implementation, specifically testing the `PythonDebugAdapter` class and its integration with the debugpy Python debugging protocol.

### Overall Purpose

The test suite validates the Python language debug adapter's core functionality, ensuring reliable Python debugging capabilities within the broader debugging framework. It focuses on environment validation, configuration management, DAP (Debug Adapter Protocol) communication, and debugpy integration.

### Key Components & Architecture

#### Core Test Structure
- **Isolated testing environment** with mocked external dependencies (`child_process`, `python-utils`)
- **Dependency injection pattern** using factory functions for consistent mock setup
- **State machine validation** testing adapter lifecycle transitions
- **Event-driven testing** simulating real debugging scenarios

#### Primary Test Categories

**Environment Management**
- Python executable resolution and caching
- Version compatibility validation (Python 3.7+ requirement)
- Virtual environment detection and debugpy dependency checking
- Graceful error handling for environment issues

**DAP Protocol Integration** 
- Command building for debugpy adapter invocation
- Exception breakpoint filter validation
- Event handling and thread tracking
- Feature capability reporting and requirements

**Configuration & Lifecycle**
- Launch configuration transformation with Python-specific defaults
- Initialization flows with proper error state management
- Connection/disconnection state transitions
- Resource cleanup and disposal

**Debugpy Backend Integration**
- Installation detection via process spawning
- Version compatibility checking
- Error message translation for user-friendly feedback

### Testing Patterns & Conventions

- **Mock-first approach** isolating units from external dependencies
- **State validation** ensuring proper adapter lifecycle management  
- **Error scenario coverage** testing failure modes and recovery
- **Caching behavior verification** preventing redundant operations
- **Type casting for internal access** validating private state when necessary

### Public API Coverage

The tests validate the adapter's public interface including:
- `resolveExecutablePath()` - Environment validation
- `buildAdapterCommand()` - DAP command construction  
- `transformLaunchConfig()` - Configuration processing
- `supportsFeature()` / `getFeatureRequirements()` - Capability reporting
- `translateErrorMessage()` - Error handling
- Lifecycle methods (`initialize`, `connect`, `disconnect`, `dispose`)

This test suite ensures the Python debug adapter reliably integrates with the debugging framework while providing robust Python-specific debugging capabilities through the debugpy protocol.