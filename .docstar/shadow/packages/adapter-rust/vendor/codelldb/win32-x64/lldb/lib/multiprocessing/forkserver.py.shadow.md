# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/multiprocessing/forkserver.py
@source-hash: e99f0aa2e4dc41af
@generated: 2026-02-09T18:11:18Z

## Python Multiprocessing Fork Server Implementation

**Primary Purpose**: Implements a fork server for multiprocessing that creates child processes on demand via Unix domain sockets, avoiding the overhead of full process creation for each new worker.

### Core Architecture

**ForkServer Class (L32-161)**: Main orchestrator that manages the lifecycle of a persistent fork server process.
- `__init__` (L34-40): Initializes state tracking (address, pid, alive_fd, inherited_fds, lock, preload_modules)
- `ensure_running` (L105-161): Lazily starts fork server if not running, handles server death/restart
- `connect_to_new_process` (L76-103): Client interface to request new child process creation
- `_stop/_stop_unlocked` (L42-60): Cleanup methods for server shutdown

**Fork Server Main Loop (L167-296)**: The actual fork server process implementation.
- Uses `selectors.DefaultSelector` for event-driven I/O multiplexing
- Handles three event sources: new client connections, SIGCHLD signals, and "alive" pipe EOF
- Creates child processes via `os.fork()` and manages their lifecycle

### Key Functions

**main()** (L167-296): Entry point for fork server process
- Sets up signal handlers for SIGCHLD and SIGINT
- Uses wakeup fd mechanism for async signal handling
- Maintains `pid_to_fd` mapping for tracking child processes

**_serve_one()** (L299-315): Executed in each forked child process
- Resets signal handlers and closes unnecessary file descriptors
- Sets up inherited fds for resource tracker and forkserver communication
- Delegates to `spawn._main()` for actual process execution

**Utility Functions**:
- `read_signed/write_signed` (L322-338): Protocol for sending signed integers over pipes
- Module-level function exports (L344-348): Expose ForkServer singleton methods

### Dependencies & Integration

- **Internal modules**: connection, process, spawn, util, resource_tracker, context.reduction
- **External integration**: Works with Python's multiprocessing framework
- **Platform**: Unix-specific (uses AF_UNIX sockets, os.fork, signal handling)

### Critical Constraints

- **MAXFDS_TO_SEND = 256** (L25): Hard limit on file descriptors per fork request
- **Thread safety**: Uses threading.Lock for concurrent access to server state
- **Signal handling**: Careful coordination between parent and child processes
- **Resource cleanup**: Proper fd closure and process reaping to prevent leaks

### Communication Protocol

1. Client connects to Unix socket and sends fds via `reduction.sendfds`
2. Server forks child and sends child PID back to client
3. Child process communicates exit code via dedicated pipe
4. Server tracks children via SIGCHLD and cleans up resources

### Architectural Decisions

- **Singleton pattern**: Single global `_forkserver` instance (L344)
- **Event-driven design**: Uses selectors for scalable I/O handling
- **Preloading support**: Can preload modules in server process to reduce fork overhead
- **Abstract socket namespace**: Supports both filesystem and abstract Unix sockets