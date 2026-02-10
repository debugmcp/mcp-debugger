# packages/adapter-python/src/python-adapter-factory.ts
@source-hash: a0e8fba357d3f75c
@generated: 2026-02-10T00:41:21Z

**Primary Purpose**: Factory class that creates and validates Python debug adapter instances within the mcp-debugger framework. Implements dependency injection pattern for Python debugger instantiation.

**Key Components**:

- **PythonAdapterFactory** (L19-110): Main factory class implementing `IAdapterFactory` interface
  - `createAdapter()` (L23-25): Simple factory method returning new `PythonDebugAdapter` instance
  - `getMetadata()` (L30-42): Returns static metadata including language info, version, file extensions (.py, .pyw), and embedded Python SVG icon
  - `validate()` (L47-90): Comprehensive environment validation checking Python executable, version (≥3.7), and debugpy installation
  - `checkDebugpyInstalled()` (L95-109): Private method using child process to verify debugpy module availability

**Dependencies**:
- `@debugmcp/shared`: Core interfaces (`IDebugAdapter`, `IAdapterFactory`, `AdapterDependencies`, etc.)
- `./python-debug-adapter.js`: The actual adapter implementation being created
- `./utils/python-utils.js`: Utility functions for Python executable discovery and version detection
- Node.js `child_process.spawn`: Used for debugpy verification

**Key Behaviors**:
- Validates Python 3.7+ requirement during environment checks
- Uses platform-specific Python detection (py launcher on Windows, python3 elsewhere)
- Returns detailed validation results with errors, warnings, and environment details
- Spawns Python subprocess to test debugpy import and version extraction

**Architectural Patterns**:
- Factory pattern implementation for adapter creation
- Dependency injection through `AdapterDependencies` parameter
- Async validation with comprehensive error handling
- Platform-aware Python executable detection strategy

**Critical Constraints**:
- Requires Python 3.7 or higher for operation
- Depends on debugpy package installation in target Python environment
- Validation provides both blocking errors and non-blocking warnings