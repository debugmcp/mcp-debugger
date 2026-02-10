# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/selectors.py
@source-hash: 1eeb102373e18c96
@generated: 2026-02-09T18:08:01Z

## Purpose
High-level I/O multiplexing module built on Python's `select` module primitives. Provides unified interface for monitoring file objects across different OS-specific mechanisms (select, poll, epoll, kqueue, devpoll) with automatic platform selection.

## Core Data Structures
- **EVENT_READ/EVENT_WRITE constants (L17-18)**: Bitwise flags for I/O event types
- **SelectorKey namedtuple (L46)**: Associates file objects with file descriptors, events, and optional data
- **_SelectorMapping (L60-78)**: Read-only mapping interface exposing selector's registered file objects

## Architecture

### Abstract Base Classes
- **BaseSelector (L80-204)**: Abstract interface defining selector contract
  - Abstract methods: `register()`, `unregister()`, `select()`, `get_map()`
  - Concrete methods: `modify()` (L137), `close()` (L173), `get_key()` (L180)
  - Context manager support via `__enter__`/`__exit__` (L199-203)

- **_BaseSelectorImpl (L206-288)**: Base implementation providing common functionality
  - Core data: `_fd_to_key` dict mapping file descriptors to SelectorKey objects
  - File object resolution via `_fileobj_lookup()` (L215) with fallback search for closed files
  - Standard register/unregister/modify implementations

### Platform-Specific Implementations

#### SelectSelector (L290-339)
- Uses `select.select()` with separate read/write fd sets
- Windows-specific handling: maps exceptions to write events (L312-317)
- Limited by FD_SETSIZE (~1024 file descriptors)

#### Poll-like Selectors Base (_PollLikeSelector L341-429)
- Abstract base for poll/epoll/devpoll implementations
- Maps generic events to platform-specific constants via `_EVENT_READ`/`_EVENT_WRITE`
- Shared timeout handling with millisecond resolution conversion
- Event mask translation logic (L420-423)

#### Concrete Poll-like Implementations
- **PollSelector (L433-437)**: Uses `select.poll()` 
- **EpollSelector (L442-485)**: Linux epoll with custom timeout handling and max events calculation
- **DevpollSelector (L490-501)**: Solaris /dev/poll
- **KqueueSelector (L506-585)**: BSD kqueue with kevent management and event counting

## Selector Detection & Selection
- **_can_use() (L588-608)**: Runtime capability detection for each selector type
- **DefaultSelector selection (L614-623)**: Automatic platform-optimal selector choice
  - Priority: kqueue > epoll > devpoll > poll > select
  - Based on OS support and runtime availability

## Key Patterns
- Template method pattern: Base classes define structure, subclasses implement specifics
- Graceful degradation: Falls back through selector types based on platform capabilities  
- Consistent error handling: Maps OS-specific errors to standard exceptions
- Resource management: Context manager support and explicit close() methods

## Critical Invariants
- File descriptors must be non-negative integers
- Events must be valid combinations of EVENT_READ|EVENT_WRITE
- Closed selectors return None from get_map()
- File object registration is 1:1 with file descriptors