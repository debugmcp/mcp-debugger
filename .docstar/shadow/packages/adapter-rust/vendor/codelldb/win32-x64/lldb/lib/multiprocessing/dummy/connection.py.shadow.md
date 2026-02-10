# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/multiprocessing/dummy/connection.py
@source-hash: d63dd1979fde9c13
@generated: 2026-02-09T18:06:10Z

## Purpose
Provides a dummy implementation of `multiprocessing.connection` that uses in-memory queues instead of sockets for inter-process communication. This is a drop-in replacement for testing or environments where socket-based IPC is not available.

## Key Components

### Listener Class (L18-38)
- **Purpose**: Accepts incoming connections via a backlog queue
- **Constructor** (L20-21): Takes optional `address`, `family`, `backlog` parameters; creates internal `Queue(backlog)`
- **accept()** (L23-24): Blocks until connection request arrives, returns `Connection` instance
- **close()** (L26-27): Nullifies internal queue reference
- **address** property (L29-31): Returns the backlog queue itself as the address
- Implements context manager protocol (L33-37)

### Client Function (L40-43)
- Factory function that creates a client-side connection
- Creates bidirectional queue pair (`_in`, `_out`)
- Puts queue pair into server's address (backlog queue)
- Returns `Connection` with reversed queue order

### Pipe Function (L46-48)
- Creates a bidirectional pipe using two queues
- Returns tuple of two `Connection` objects with swapped input/output queues
- `duplex` parameter accepted but ignored (always bidirectional)

### Connection Class (L51-75)
- **Core abstraction**: Wraps two queues to provide bidirectional communication
- **Constructor** (L53-57): Takes `_in` and `_out` queues, aliases methods to queue operations
- **Method aliases**: `send`/`send_bytes` → `_out.put`, `recv`/`recv_bytes` → `_in.get`
- **poll()** (L59-66): Non-blocking check for available data with optional timeout using queue's condition variable
- **close()** (L68-69): No-op implementation
- Implements context manager protocol (L71-75)

## Architecture
- Uses `queue.Queue` as the underlying transport mechanism
- Maintains API compatibility with `multiprocessing.connection`
- Thread-safe due to Queue's built-in synchronization
- Suitable for single-process, multi-threaded scenarios

## Dependencies
- `queue.Queue`: Python's thread-safe FIFO queue implementation

## Global Variables
- `families` (L15): Single-element list containing `None`, mimics socket family concept
- `__all__` (L10): Exports `Client`, `Listener`, `Pipe` functions