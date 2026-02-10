# packages/adapter-python/src/python-debug-adapter.ts
@source-hash: f5bb3929b92b788a
@generated: 2026-02-10T01:19:09Z

## Purpose
Python-specific debug adapter implementation that provides Python debugging functionality using debugpy. Encapsulates Python executable discovery, environment validation, debugpy integration, and manages DAP protocol operations for Python debugging sessions.

## Key Classes & Interfaces

### PythonPathCacheEntry (L39-44)
Cache structure for Python executable paths with timestamp, version info, and debugpy availability status.

### PythonLaunchConfig (L49-60)
Extended launch configuration interface for Python-specific debugging options including module execution, Django/Flask support, console types, and subprocess debugging.

### PythonDebugAdapter (L65-668)
Main adapter class implementing `IDebugAdapter` interface for Python debugging.

**State Management:**
- `state` (L69): Current adapter state tracking
- `pythonPathCache` (L73): Cached Python executable information with 1-minute TTL
- `currentThreadId` (L77): Active debugging thread
- `connected` (L78): Connection status flag

**Core Lifecycle Methods:**
- `initialize()` (L87-116): Validates Python environment and transitions to READY state
- `dispose()` (L118-124): Cleanup method clearing cache and resetting state
- `validateEnvironment()` (L150-214): Comprehensive environment validation checking Python version, debugpy installation

**Executable Management:**
- `resolveExecutablePath()` (L235-258): Cached Python executable resolution with fallback logic
- `getExecutableSearchPaths()` (L269-305): Platform-specific Python installation path discovery
- `buildAdapterCommand()` (L309-323): Constructs debugpy adapter command with proper environment

**Debug Configuration:**
- `transformLaunchConfig()` (L335-349): Converts generic config to Python-specific launch configuration
- `getCapabilities()` (L529-591): Returns comprehensive DAP capabilities including breakpoints, exception handling, variable inspection

**DAP Protocol Operations:**
- `sendDapRequest()` (L362-385): Validates Python-specific DAP requests (e.g., exception breakpoint filters)
- `handleDapEvent()` (L387-395): Processes DAP events and updates thread state
- `connect()/disconnect()` (L403-422): Connection lifecycle management

**Python-Specific Utilities:**
- `checkPythonVersion()` (L598-613): Cached Python version detection
- `checkDebugpyInstalled()` (L618-649): Validates debugpy installation via import test
- `detectVirtualEnv()` (L654-668): Virtual environment detection using sys module introspection

## Dependencies
- **External**: `@vscode/debugprotocol`, `@debugmcp/shared`, Node.js built-ins (`events`, `child_process`, `path`)
- **Internal**: `./utils/python-utils.js` for executable discovery utilities

## Architecture Patterns
- **Caching**: Implements TTL-based caching for Python executable paths and metadata
- **State Machine**: Uses `AdapterState` enum for lifecycle management with event emission
- **Template Method**: Implements `IDebugAdapter` interface with Python-specific behavior
- **Command Builder**: Constructs platform-appropriate debugpy commands
- **Error Translation**: Converts low-level Python errors to user-friendly messages

## Critical Constraints
- Requires Python 3.7+ (enforced in validation)
- Depends on debugpy module availability
- Cache timeout set to 60 seconds for executable resolution
- Platform-specific executable search paths and naming conventions
- Thread safety considerations for concurrent cache access