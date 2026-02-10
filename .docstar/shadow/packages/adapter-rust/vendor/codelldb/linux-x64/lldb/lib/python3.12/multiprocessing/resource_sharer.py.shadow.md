# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/multiprocessing/resource_sharer.py
@source-hash: bba3c7f2b76a9cf4
@generated: 2026-02-09T18:06:13Z

## Primary Purpose
Cross-platform resource sharing mechanism for multiprocessing using a background thread server. Enables pickling/unpickling of file descriptors (Unix) and sockets (Windows) across process boundaries by registering resources with unique identifiers and serving them through IPC connections.

## Key Classes and Functions

### Platform-Specific Wrappers
- **`DupSocket` (L27-40)**: Windows-only picklable socket wrapper. Creates duplicate socket in `__init__`, registers sender function with resource sharer, provides `detach()` method to retrieve socket via `socket.fromshare()`
- **`DupFd` (L45-58)**: Unix-only file descriptor wrapper. Duplicates fd with `os.dup()`, registers sender using `reduction.send_handle()`, provides `detach()` method using `reduction.recv_handle()`

### Core Resource Management
- **`_ResourceSharer` (L61-151)**: Main singleton class managing resource sharing infrastructure
  - `register()` (L72-79): Registers send/close function pair, returns (address, key) identifier
  - `get_connection()` (L82-88): Static method creating authenticated client connection to retrieve resource
  - `stop()` (L90-110): Graceful shutdown with timeout, closes all cached resources and background thread
  - `_start()` (L122-131): Initializes listener and daemon thread for serving requests
  - `_serve()` (L133-150): Background thread loop handling resource requests, blocks signals on Unix
  - `_afterfork()` (L111-121): Fork cleanup - closes resources and resets state

## Architecture Pattern
Uses singleton `_resource_sharer` instance (L153) with module-level `stop` function (L154). Resources are cached with auto-incrementing keys, served once then removed. Authentication uses process authkeys for security.

## Critical Dependencies
- `.connection` module for `Listener`/`Client` IPC
- `.context.reduction` for Unix handle transfer
- `.util` for fork registration and debugging
- `.process` for current process authkey

## Important Constraints
- Resources served exactly once (pop from cache in `_serve()`)
- Thread safety via `_lock` for cache operations
- Platform detection via `sys.platform == 'win32'`
- Background thread runs as daemon with signal blocking on Unix
- Fork-safe with automatic cleanup registration