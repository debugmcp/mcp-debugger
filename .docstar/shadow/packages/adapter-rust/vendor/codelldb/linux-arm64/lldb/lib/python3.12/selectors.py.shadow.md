# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/selectors.py
@source-hash: 1eeb102373e18c96
@generated: 2026-02-09T18:09:07Z

## Purpose
High-level I/O multiplexing module that provides a unified interface for monitoring file descriptors across different operating systems. Built on Python's `select` module primitives to abstract platform-specific I/O multiplexing mechanisms.

## Core Architecture

### Event Constants (L17-18)
- `EVENT_READ = 1 << 0`: Bitmask for read events
- `EVENT_WRITE = 1 << 1`: Bitmask for write events

### Key Data Structures

**SelectorKey** (L46-57): `namedtuple` representing registered file objects
- Fields: `fileobj`, `fd`, `events`, `data`
- Immutable association between file objects and their monitoring configuration

**_SelectorMapping** (L60-78): Read-only mapping interface for accessing registered file objects
- Implements `collections.abc.Mapping` protocol
- Provides dictionary-like access to selector keys via file objects

### Base Classes

**BaseSelector** (L80-204): Abstract base class defining selector interface
- Core methods: `register()`, `unregister()`, `modify()`, `select()`, `close()`
- Context manager protocol support (`__enter__`/`__exit__`)
- Abstract methods must be implemented by subclasses

**_BaseSelectorImpl** (L206-288): Concrete base implementation
- Manages `_fd_to_key` mapping (L211) for file descriptor to key associations
- Provides common functionality for file object registration/unregistration
- `_fileobj_lookup()` (L215-232) with fallback search for closed file objects

## Selector Implementations

### SelectSelector (L290-338)
- Uses `select.select()` system call
- Maintains separate `_readers` and `_writers` sets (L295-296)
- Platform-specific handling for Windows (L312-317)
- Limited by FD_SETSIZE constraint (~1024 file descriptors)

### _PollLikeSelector (L341-429)
- Base class for poll(), epoll(), and devpoll() based selectors
- Template method pattern with subclass-defined `_selector_cls`, `_EVENT_READ`, `_EVENT_WRITE`
- Timeout handling with millisecond conversion (L410-412)

### Platform-Specific Selectors
- **PollSelector** (L433-437): Uses `select.poll()` 
- **EpollSelector** (L442-485): Linux epoll with enhanced timeout handling and `fileno()` support
- **DevpollSelector** (L490-501): Solaris /dev/poll
- **KqueueSelector** (L506-585): BSD kqueue with event-based registration and `_max_events` tracking

## Selector Selection Logic

**_can_use()** (L588-608): Runtime capability detection
- Tests if selector methods are available and functional
- Handles OSError for unsupported implementations

**DefaultSelector Assignment** (L614-623): Automatic best-implementation selection
Priority: kqueue > epoll > devpoll > poll > select

## Key Utilities

**_fileobj_to_fd()** (L21-43): Converts file objects to file descriptors
- Accepts integers or objects with `fileno()` method
- Validation for non-negative file descriptors

## Error Handling Patterns
- KeyError for unregistered file objects
- ValueError for invalid events or file descriptors  
- OSError handling for closed file descriptors during unregistration
- InterruptedError handling in select loops