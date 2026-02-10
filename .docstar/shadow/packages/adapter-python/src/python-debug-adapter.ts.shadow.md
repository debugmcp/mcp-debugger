# packages/adapter-python/src/python-debug-adapter.ts
@source-hash: 33e93102e4351a3e
@generated: 2026-02-09T18:14:46Z

## Primary Purpose
Python Debug Adapter implementation that provides Python-specific debugging functionality using debugpy. This is a concrete implementation of the IDebugAdapter interface that handles Python executable discovery, environment validation, debugpy integration, and DAP protocol operations for Python debugging sessions.

## Key Classes & Interfaces

### PythonDebugAdapter (L65-670)
Main adapter class extending EventEmitter and implementing IDebugAdapter. Manages the complete Python debugging lifecycle including initialization, environment validation, connection management, and debug configuration transformation.

**Core State Management:**
- `state: AdapterState` (L69) - Current adapter state
- `pythonPathCache` (L73) - Caches Python executable paths with timestamps
- `currentThreadId` (L77) - Tracks active debugging thread
- `connected` (L78) - Connection status flag

**Key Methods:**
- `initialize()` (L87-116) - Initializes adapter and validates Python environment
- `validateEnvironment()` (L150-214) - Comprehensive environment validation including Python version and debugpy checks
- `resolveExecutablePath()` (L235-258) - Finds Python executable with caching
- `transformLaunchConfig()` (L335-349) - Converts generic launch config to Python-specific configuration
- `buildAdapterCommand()` (L309-323) - Builds debugpy adapter command
- `getCapabilities()` (L530-592) - Returns Python debugging capabilities

### PythonLaunchConfig Interface (L49-60)
Extends LanguageSpecificLaunchConfig with Python-specific debugging options:
- `module?` - For `-m` module execution
- `console?` - Console type (integrated/internal/external)
- `django?/flask?/jinja?` - Framework-specific debugging flags
- `redirectOutput?/showReturnValue?/subProcess?` - Advanced debugging options

### PythonPathCacheEntry Interface (L39-44)
Cache structure for Python executable information including path, timestamp, version, and debugpy availability.

## Dependencies & Relationships
- **External:** debugpy module (Python debugging protocol implementation)
- **Shared Components:** Imports from `@debugmcp/shared` for interfaces, types, and utilities
- **Utilities:** `python-utils.js` (L34) for Python executable discovery and version checking
- **Child Processes:** Uses Node.js `spawn` for Python subprocess execution

## Architecture Patterns

### Caching Strategy (L73-74, L236-258)
Implements 1-minute TTL cache for Python executable paths to avoid repeated filesystem lookups and version checks.

### State Machine (L142-146)
Uses formal state transitions with event emission for lifecycle management (UNINITIALIZED → INITIALIZING → READY → CONNECTED → DEBUGGING).

### Error Translation (L457-477)
Provides user-friendly error messages for common Python/debugpy installation issues.

## Critical Features & Capabilities

### Environment Validation (L150-214)
- Python version check (requires 3.7+)
- debugpy installation verification
- Virtual environment detection
- Comprehensive error reporting with recovery suggestions

### Platform Support (L260-305)
Cross-platform Python executable discovery with platform-specific search paths:
- Windows: `py` launcher, various Python installation directories
- macOS: Homebrew, system paths
- Linux: Standard system paths

### DAP Protocol Integration (L362-400)
- Python-specific exception breakpoint filters validation
- Thread ID tracking for debugging sessions
- Event handling for debugger state changes

## Installation & Setup Guidance
Provides detailed installation instructions (L427-455) covering:
- Python 3.7+ installation per platform
- debugpy installation via pip
- Virtual environment setup
- Common troubleshooting scenarios

## Critical Invariants
- Cache entries expire after 60 seconds to ensure fresh executable discovery
- State transitions always emit events for external listeners
- Python 3.7+ version requirement is strictly enforced
- debugpy must be installed and importable for debugging to function