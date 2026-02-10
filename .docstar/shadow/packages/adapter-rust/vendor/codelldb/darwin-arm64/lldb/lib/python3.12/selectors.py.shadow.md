# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/selectors.py
@source-hash: 1eeb102373e18c96
@generated: 2026-02-09T18:07:27Z

## Purpose
High-level I/O multiplexing module providing efficient event-driven I/O operations built on Python's `select` module primitives. Implements platform-specific selector classes with a common interface for monitoring file descriptors for read/write events.

## Core Architecture

### Event Constants (L17-18)
- `EVENT_READ = (1 << 0)`: Bitwise flag for read events
- `EVENT_WRITE = (1 << 1)`: Bitwise flag for write events

### Key Data Structures

**SelectorKey namedtuple (L46-57)**: Core data container associating file objects with their metadata
- Fields: `fileobj`, `fd`, `events`, `data`
- Represents a registered file object with its backing file descriptor, event mask, and attached data

**_SelectorMapping (L60-78)**: Mapping interface for file objects to selector keys
- Provides dict-like access to registered file objects
- Delegates to selector's internal `_fd_to_key` mapping

### Abstract Base Classes

**BaseSelector (L80-204)**: Abstract interface defining selector contract
- Key methods: `register()`, `unregister()`, `modify()`, `select()`, `close()`
- Context manager support via `__enter__`/`__exit__`
- `get_key()` (L180-192): Retrieves SelectorKey for registered file object
- `get_map()` (L194-197): Returns mapping of file objects to keys

**_BaseSelectorImpl (L206-288)**: Concrete base implementation
- `_fd_to_key`: Core mapping from file descriptors to SelectorKey objects
- `_fileobj_lookup()` (L215-232): Robust file descriptor resolution with exhaustive search fallback
- Implements standard register/unregister/modify operations
- `_key_from_fd()` (L275-287): Helper to retrieve key by file descriptor

### Platform-Specific Implementations

**SelectSelector (L290-339)**: select()-based implementation
- Maintains `_readers` and `_writers` sets for file descriptors
- Platform-specific `_select()` method (L312-317): Windows uses different error handling
- `select()` method handles InterruptedError gracefully

**_PollLikeSelector (L341-429)**: Base class for poll/epoll/devpoll selectors
- Abstract attributes: `_selector_cls`, `_EVENT_READ`, `_EVENT_WRITE`
- Unified timeout handling with millisecond conversion (L410-412)
- Event mapping between generic events and platform-specific constants

**PollSelector (L433-437)**: poll()-based selector (when available)
- Uses `select.poll`, `select.POLLIN`, `select.POLLOUT`

**EpollSelector (L442-486)**: Linux epoll-based selector (when available)
- Enhanced with `fileno()` method and custom `select()` with maxevents handling
- Proper resource cleanup via `close()`

**DevpollSelector (L490-502)**: Solaris /dev/poll selector (when available)
- Similar to epoll but Solaris-specific

**KqueueSelector (L506-586)**: BSD kqueue-based selector (when available)
- More complex event management using kevent objects
- Maintains `_max_events` counter for proper kqueue operation
- Separate read/write event registration and cleanup

## Selector Detection & Selection

**_can_use() (L588-609)**: Platform capability detection function
- Tests if selector method exists and is functional
- Handles OSError for unsupported kernel features

**DefaultSelector Selection (L614-623)**: Platform-optimized selector choice
- Priority: kqueue > epoll > devpoll > poll > select
- Automatically chooses best available implementation

## Key Design Patterns

1. **Strategy Pattern**: Multiple selector implementations with common interface
2. **Template Method**: _PollLikeSelector provides shared poll/epoll/devpoll logic
3. **Factory Pattern**: DefaultSelector automatically selects optimal implementation
4. **Resource Management**: Context manager support and explicit cleanup methods
5. **Graceful Degradation**: Fallback chain from high-performance to basic selectors

## Dependencies
- `select` module: Core I/O multiplexing primitives
- `abc`: Abstract base class support
- `collections`: namedtuple for SelectorKey
- `math`: Timeout calculations for poll-based selectors

## Critical Invariants
- File descriptors must be >= 0
- Events must be valid combinations of EVENT_READ/EVENT_WRITE
- Each file descriptor can only be registered once per selector
- Selectors handle closed file descriptors gracefully during unregistration