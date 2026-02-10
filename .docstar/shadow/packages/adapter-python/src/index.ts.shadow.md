# packages/adapter-python/src/index.ts
@source-hash: 5a65de616d55fb6e
@generated: 2026-02-10T00:41:18Z

## Purpose
Entry point module for the `@debugmcp/adapter-python` package, providing a centralized export interface for Python debugging adapter functionality.

## Exports

### Adapter Classes (L6-7)
- **PythonAdapterFactory**: Factory class for creating Python debug adapter instances
- **PythonDebugAdapter**: Core adapter implementation for Python debugging sessions

### Utility Functions (L10-15)
- **findPythonExecutable**: Locates Python interpreter executable on the system
- **getPythonVersion**: Retrieves version information from Python executable
- **setDefaultCommandFinder**: Configures custom command discovery behavior
- **CommandNotFoundError**: Exception class for missing command scenarios

### Types (L18)
- **CommandFinder**: Type definition for command discovery function interface

## Architecture
Follows typical package entry pattern with clean separation between:
- Core adapter implementations (factory + debug adapter)
- System utilities for Python environment detection
- Type definitions for extensibility

All exports use ES module syntax with explicit file extensions, indicating modern TypeScript/Node.js compatibility requirements.