# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/multiprocessing/managers.py
@source-hash: 7c5431f44b7f966a
@generated: 2026-02-09T18:06:21Z

## multiprocessing/managers.py

**Primary Purpose**: Core multiprocessing managers module that provides client-server infrastructure for sharing objects across processes via proxy objects and remote method calls.

### Key Architecture Components

**Token Class (L62-79)**: Uniquely identifies shared objects with `typeid`, `address`, and `id` attributes. Handles pickling/unpickling for cross-process communication.

**Server Class (L139-466)**: The heart of the manager system - runs in a separate process and manages shared objects.
- `serve_forever()` (L164-184): Main server loop with threaded connection handling
- `accepter()` (L186-194): Accepts incoming connections and spawns handler threads
- `serve_client()` (L238-318): Handles method calls from proxy objects, manages object lifecycle
- `create()` (L373-407): Creates new shared objects, assigns IDs, manages reference counting
- `incref()`/`decref()` (L423-465): Reference counting for garbage collection

**BaseManager Class (L491-735)**: Client-side manager that spawns and communicates with Server processes.
- `start()` (L535-576): Spawns server process, establishes communication pipe
- `_create()` (L601-611): Creates shared objects via server communication
- `register()` (L697-735): Class method to register new shareable types with proxy classes

**BaseProxy Class (L751-925)**: Base class for all proxy objects that represent remote shared objects.
- `_callmethod()` (L808-836): Core method that sends requests to server and handles responses
- `_incref()`/`_decref()` (L844-887): Client-side reference counting with cleanup
- Thread-local connection management via `_tls` attribute

### Communication Protocol

**dispatch() function (L85-93)**: Core communication primitive - sends `(id, methodname, args, kwds)` tuples and processes responses.

**Response types**: `#RETURN`, `#PROXY`, `#ERROR`, `#TRACEBACK`, `#UNSERIALIZABLE`

**convert_to_error() (L95-108)**: Converts server error responses to client-side exceptions.

### Proxy Type System

**AutoProxy() (L973-996)**: Dynamically creates proxy types by querying server for exposed methods.

**MakeProxyType() (L951-970)**: Factory function that generates proxy classes with dynamic method injection via `exec()`.

**Specialized Proxy Classes**:
- `IteratorProxy` (L1033-1044): For iterators
- `AcquirerProxy` (L1047-1057): For locks/semaphores
- `ConditionProxy` (L1060-1084): For condition variables
- `ListProxy`/`DictProxy`/etc.: Container proxies with specialized behavior

### Manager Implementations

**SyncManager (L1199-1229)**: Standard manager with built-in types (Queue, Lock, list, dict, etc.)

**SharedMemoryManager (L1318-1379)** (if available): Specialized manager for shared memory objects with automatic cleanup via `_SharedMemoryTracker` (L1236-1270).

### Key Patterns

- **Reference Counting**: Both client and server maintain reference counts for proper cleanup
- **Thread Safety**: Extensive use of locks (`Server.mutex`, `BaseProxy._mutex`) 
- **Process Forking**: Special handling via `_after_fork()` methods and `ProcessLocalSet`
- **Serialization**: Pluggable serializer system (pickle, xmlrpc)
- **Error Handling**: Comprehensive error conversion and remote exception propagation

### Dependencies

- `connection` module for network communication
- `process` module for authentication and process management  
- `util` module for debugging and cleanup utilities
- Optional `shared_memory` module for memory-mapped objects