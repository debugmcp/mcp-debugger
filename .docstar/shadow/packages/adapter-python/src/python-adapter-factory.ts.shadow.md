# packages\adapter-python\src\python-adapter-factory.ts
@source-hash: 2a3884da1c057c9d
@generated: 2026-02-23T15:25:59Z

## Primary Purpose
Factory implementation for creating Python debug adapter instances within the mcp-debugger system. Handles environment validation, Python installation detection, and dependency injection for Python debugging capabilities.

## Key Components

### PythonAdapterFactory Class (L19-111)
Main factory class implementing `IAdapterFactory` interface. Provides three core methods:
- `createAdapter()` (L23-25): Instantiates new `PythonDebugAdapter` with provided dependencies
- `getMetadata()` (L30-42): Returns static metadata including language type, version, file extensions, and embedded Python icon
- `validate()` (L47-91): Performs comprehensive environment validation for Python debugging prerequisites

### Private Methods
- `checkDebugpyInstalled()` (L96-110): Spawns Python process to verify debugpy module availability using import test

## Dependencies
- `@debugmcp/shared`: Core interfaces (`IDebugAdapter`, `IAdapterFactory`, `AdapterDependencies`, `FactoryValidationResult`)
- `./python-debug-adapter.js`: Concrete Python adapter implementation
- `./utils/python-utils.js`: Python executable detection utilities
- `child_process`: Node.js spawn for subprocess execution

## Validation Logic
The `validate()` method performs multi-stage checks:
1. Python executable detection via `findPythonExecutable()`
2. Version validation (requires Python 3.7+)
3. Debugpy availability check (warning-level only for virtualenv compatibility)
4. Returns structured result with errors/warnings and environment details

## Architectural Patterns
- Factory pattern implementation for adapter creation
- Dependency injection through `AdapterDependencies` parameter
- Promise-based async validation with comprehensive error handling
- Platform-aware detection (Windows py launcher vs python3)

## Critical Details
- Debugpy validation is warning-only to support virtualenv workflows (issue #16 reference)
- Embedded base64 Python icon in metadata
- Version requirement: Python 3.7+ minimum
- Supports .py and .pyw file extensions