# packages/adapter-python/src/index.ts
@source-hash: 5a65de616d55fb6e
@generated: 2026-02-09T18:14:29Z

**Purpose**: Entry point for the `@debugmcp/adapter-python` package, providing a clean public API for Python debugging adapter functionality.

**Exports Structure**:
- **Adapters** (L6-7): Core debugging adapter components
  - `PythonAdapterFactory` (L6): Factory for creating Python debug adapter instances
  - `PythonDebugAdapter` (L7): Main Python debugging adapter implementation

- **Utilities** (L10-15): Python environment and executable management
  - `findPythonExecutable` (L11): Locates Python interpreter on system
  - `getPythonVersion` (L12): Retrieves version information from Python executable
  - `setDefaultCommandFinder` (L13): Configures custom command location strategy
  - `CommandNotFoundError` (L14): Exception for missing Python executables

- **Types** (L18): TypeScript interfaces for external consumption
  - `CommandFinder` (L18): Function signature for custom executable location logic

**Dependencies**: 
- `./python-adapter-factory.js` - Factory pattern implementation
- `./python-debug-adapter.js` - Core adapter logic
- `./utils/python-utils.js` - Python environment utilities and types

**Architectural Pattern**: Barrel export pattern providing a single import point for the entire package. Separates concerns into adapters (core functionality), utilities (environment management), and types (TypeScript definitions).