# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/multiprocessing/
@generated: 2026-02-09T18:16:20Z

## Purpose and Responsibility

The `multiprocessing` module is Python's core infrastructure for parallel processing using separate processes rather than threads. This directory provides a complete process-based parallelism framework including process lifecycle management, inter-process communication, shared object management, resource sharing, and platform-specific process spawning implementations.

## Key Components and Architecture

### Process Management Core (`process.py`)
- **`BaseProcess`**: Abstract base class analogous to `threading.Thread` for separate processes
- **Process lifecycle**: Creation, starting, joining, termination, and cleanup
- **Global state management**: `current_process()`, `active_children()`, `parent_process()`
- **Authentication**: `AuthenticationString` for secure inter-process communication
- **Identity chains**: Hierarchical process tracking and config inheritance

### Object Sharing Infrastructure (`managers.py`)
- **Server-Client Architecture**: `Server` class runs in separate process, manages shared objects
- **Proxy System**: `BaseProxy` and specialized proxies (`ListProxy`, `DictProxy`, etc.) provide transparent remote object access
- **`BaseManager`**: Client-side manager that spawns servers and creates proxy objects
- **Reference Counting**: Distributed garbage collection across processes
- **Communication Protocol**: Request-response pattern with error handling and serialization

### Serialization and Resource Transfer (`reduction.py`, `resource_sharer.py`)
- **`ForkingPickler`**: Extended pickle.Pickler with multiprocessing-specific reducers
- **Cross-platform handle/FD passing**: Windows handle duplication vs Unix SCM_RIGHTS
- **Resource sharing server**: Background thread serving registered resources via unique identifiers
- **Built-in type reducers**: Custom serialization for methods, sockets, partial functions

### Platform-Specific Process Spawning (`popen_spawn_posix.py`)
- **Spawn method implementation**: Fresh interpreter process creation (vs fork)
- **File descriptor management**: Tracking and passing FDs to child processes
- **Serialization-based IPC**: Process state transfer via pipes and reduction module
- **Resource cleanup**: Finalizer-based cleanup with resource tracker integration

### Core Utilities (`util.py`)
- **Logging infrastructure**: Multiprocessing-specific logging with custom levels
- **Finalization system**: Weakref-based cleanup with priority ordering
- **Fork-aware types**: Thread locks and local storage that reinitialize after fork
- **Process management utilities**: FD management, process spawning, cleanup coordination
- **Exit handling**: Comprehensive shutdown with daemon termination and finalizer execution

## Public API Surface

### Main Entry Points
- **Process Classes**: `BaseProcess` and platform-specific implementations
- **Manager Classes**: `BaseManager`, `SyncManager`, `SharedMemoryManager`
- **Proxy Creation**: `MakeProxyType()`, `AutoProxy()` for custom shared types
- **Global Functions**: `current_process()`, `active_children()`, `parent_process()`

### Key Registration Points
- **`BaseManager.register()`**: Register new shareable types with custom proxy classes
- **`ForkingPickler.register()`**: Add custom reduction functions for serialization
- **`register_after_fork()`**: Register objects/functions for post-fork reinitialization

### Utility Functions
- **Logging**: `get_logger()`, `log_to_stderr()` for debugging
- **Cleanup**: `is_exiting()`, finalization system for resource management
- **Platform detection**: Abstract socket support, handle passing capabilities

## Internal Organization and Data Flow

### Process Creation Flow
1. **`BaseProcess.start()`** creates subprocess via platform-specific `_Popen`
2. **`popen_spawn_posix.Popen`** serializes process state and spawns fresh interpreter
3. **Child process** deserializes state and executes `_bootstrap()` → `run()`
4. **Parent tracks** child in global `_children` set with cleanup monitoring

### Shared Object Access Flow
1. **`BaseManager.start()`** spawns `Server` process with communication pipe
2. **Client calls** `manager.list()` → `_create()` → server creates object → returns proxy
3. **Proxy method calls** → `_callmethod()` → `dispatch()` → server execution → response
4. **Reference counting** maintains object lifecycle across processes

### Resource Sharing Flow
1. **Non-picklable resource** (socket/FD) wrapped in `DupSocket`/`DupFd`
2. **Registration** with `_resource_sharer` returns unique (address, key)
3. **Serialization** stores address/key, not actual resource
4. **Deserialization** connects to sharer, retrieves resource once, closes registration

## Important Patterns and Conventions

### Design Patterns
- **Proxy Pattern**: Transparent remote object access via `BaseProxy` hierarchy
- **Template Method**: `BaseProcess._Popen()` implementation varies by platform
- **Singleton**: Global process registry, resource sharer, logger instances
- **Factory Pattern**: `MakeProxyType()` dynamically creates proxy classes
- **Observer Pattern**: Process cleanup via weakref callbacks and finalization

### Critical Invariants
- **Single start constraint**: Processes can only be started once
- **Reference counting**: Prevents premature garbage collection of shared objects
- **Authentication**: All IPC connections use process auth keys for security
- **Fork safety**: Special handling for locks, thread-locals, and cleanup registries
- **Resource cleanup**: Strict ordering of finalizers, daemon termination, and process joining

### Error Handling
- **Remote exceptions**: Server exceptions propagated to client via `#ERROR`/`#TRACEBACK`
- **Connection failures**: Automatic cleanup and resource deregistration
- **Process monitoring**: Sentinel FDs and exit code tracking for process health
- **Platform differences**: Abstracted handle/FD passing with fallback behaviors