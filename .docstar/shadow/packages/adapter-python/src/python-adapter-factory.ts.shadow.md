# packages/adapter-python/src/python-adapter-factory.ts
@source-hash: a0e8fba357d3f75c
@generated: 2026-02-09T18:14:31Z

## Primary Purpose
Factory implementation for creating Python debug adapter instances within the debugmcp ecosystem. Provides environment validation, adapter instantiation, and metadata management for Python debugging capabilities.

## Key Classes and Functions

**PythonAdapterFactory (L19-110)** - Main factory class implementing IAdapterFactory interface
- `createAdapter(dependencies)` (L23-25) - Creates new PythonDebugAdapter instances with injected dependencies
- `getMetadata()` (L30-42) - Returns comprehensive adapter metadata including version, file extensions, and Python logo
- `validate()` (L47-90) - Validates Python environment, version requirements (≥3.7), and debugpy installation
- `checkDebugpyInstalled()` (L95-109) - Private method using child process to verify debugpy module availability

## Dependencies and Architecture

**Core Dependencies:**
- `@debugmcp/shared` - Provides adapter interfaces and types (IDebugAdapter, IAdapterFactory, AdapterDependencies)
- `./python-debug-adapter.js` - The actual Python adapter implementation
- `./utils/python-utils.js` - Python executable discovery and version detection utilities
- `child_process.spawn` - For debugpy installation verification

**Architectural Pattern:**
- Factory pattern implementation for dependency injection
- Implements validation-first approach with comprehensive error reporting
- Platform-aware detection (Windows py launcher vs python3 command)

## Critical Features

**Environment Validation:**
- Python version constraint enforcement (minimum 3.7)
- debugpy dependency verification via import test
- Cross-platform Python executable detection
- Detailed validation results with errors, warnings, and environment details

**Metadata Configuration:**
- Supports `.py` and `.pyw` file extensions
- Embedded base64-encoded Python logo SVG
- Version tracking and documentation URL reference
- Language-specific adapter identification

## Runtime Behavior

The factory performs async validation checking Python availability, version compatibility, and required debugpy installation before adapter creation. Validation results include platform detection method and timestamp for debugging purposes.