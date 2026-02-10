# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/multiprocessing/resource_sharer.py
@source-hash: bba3c7f2b76a9cf4
@generated: 2026-02-09T18:11:15Z

## Purpose
Cross-platform resource sharing system for multiprocessing, enabling serialization/deserialization of file descriptors (Unix) and sockets (Windows) using a background thread server.

## Key Classes & Functions

### Platform-Specific Wrappers
- **`DupSocket` (L27-40)**: Windows socket wrapper that duplicates socket and registers with resource sharer for cross-process sharing
  - `__init__()`: Creates duplicate socket, registers send callback with `_resource_sharer.register()`
  - `detach()`: Retrieves shared socket via connection, calls `socket.fromshare()`

- **`DupFd` (L45-58)**: Unix file descriptor wrapper for cross-process sharing
  - `__init__()`: Duplicates fd with `os.dup()`, registers send callback using `reduction.send_handle()`
  - `detach()`: Retrieves fd via `reduction.recv_handle()`

### Core Resource Manager
- **`_ResourceSharer` (L61-151)**: Background thread-based resource sharing manager
  - `register()` (L72-79): Registers resource with send/close callbacks, returns (address, key) identifier
  - `get_connection()` (L81-88): Static method creating client connection for resource retrieval
  - `stop()` (L90-109): Graceful shutdown with timeout, cleans up thread/listener/cache
  - `_start()` (L122-131): Initializes listener and daemon thread calling `_serve()`
  - `_serve()` (L133-151): Main server loop handling resource transfer requests

## Architecture & Dependencies
- **Dependencies**: `process`, `context.reduction`, `util` from same package; standard `os`, `socket`, `threading`
- **Global Instance**: `_resource_sharer` (L153) - singleton instance used by platform wrappers
- **Fork Safety**: `_afterfork()` (L111-120) handles post-fork cleanup via `util.register_after_fork()`

## Key Patterns
- **Platform Abstraction**: Conditional imports/classes based on `sys.platform == 'win32'`
- **Resource Lifecycle**: Register → Transfer → Auto-cleanup pattern with send/close callback pairs
- **Thread Safety**: Uses `threading.Lock()` for cache/state protection
- **Connection Protocol**: Client sends `(key, pid)`, server responds with resource data
- **Signal Handling**: Server thread blocks all signals using `pthread_sigmask()` (L134-135)

## Critical Invariants
- Resources auto-removed from cache after single transfer (L143: `cache.pop()`)
- `detach()` methods should only be called once per instance
- Server thread runs as daemon (L129) for automatic cleanup on process exit
- Fork safety requires cache clearing and resource cleanup in child processes