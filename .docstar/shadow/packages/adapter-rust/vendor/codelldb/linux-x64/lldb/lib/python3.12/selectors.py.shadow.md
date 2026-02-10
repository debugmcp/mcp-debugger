# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/selectors.py
@source-hash: 1eeb102373e18c96
@generated: 2026-02-09T18:10:00Z

## Python Selectors Module

**Primary Purpose**: High-level I/O multiplexing abstraction built on top of Python's `select` module primitives. Provides a cross-platform interface for monitoring multiple file descriptors for readiness events.

### Core Constants & Utilities
- `EVENT_READ` (L17), `EVENT_WRITE` (L18): Bitmask constants for I/O event types
- `_fileobj_to_fd()` (L21-43): Converts file objects to file descriptors, validates FD >= 0
- `SelectorKey` (L46): NamedTuple representing a registered file object with fields: fileobj, fd, events, data

### Abstract Base Classes
- `BaseSelector` (L80-204): ABC defining the selector interface
  - Abstract methods: `register()`, `unregister()`, `select()`, `get_map()`
  - Default `modify()` implementation (L137-152) using unregister/register
  - Context manager support (`__enter__`/`__exit__`)
  
- `_SelectorMapping` (L60-78): Read-only mapping interface for registered file objects

### Base Implementation
- `_BaseSelectorImpl` (L206-288): Common functionality for concrete selectors
  - `_fd_to_key` dict maps file descriptors to SelectorKey objects
  - `_fileobj_lookup()` (L215-232) handles closed file objects gracefully
  - Implements registration validation and key management

### Concrete Selector Implementations

**SelectSelector** (L290-339): Uses `select.select()`
- Maintains separate `_readers` and `_writers` sets
- Platform-specific `_select()` method (Windows vs Unix) (L312-317)
- Limited by FD_SETSIZE on some platforms

**_PollLikeSelector** (L341-429): Base for poll/epoll/devpoll selectors
- Template class with platform-specific `_selector_cls`, `_EVENT_READ`, `_EVENT_WRITE`
- Handles timeout conversion to milliseconds (L410-412)
- Event mapping between generic and platform-specific constants

**Platform-Specific Selectors**:
- `PollSelector` (L433-437): Uses `select.poll()` if available
- `EpollSelector` (L442-485): Linux epoll with custom timeout handling and `fileno()` support
- `DevpollSelector` (L490-501): Solaris /dev/poll
- `KqueueSelector` (L506-585): BSD kqueue with kevent management and `_max_events` tracking

### Selector Selection Logic
- `_can_use()` (L588-608): Runtime capability detection for selector methods
- Automatic best selector selection (L614-623): kqueue > epoll > devpoll > poll > select
- `DefaultSelector`: Platform-optimal selector class alias

### Key Architectural Patterns
- Strategy pattern for different I/O multiplexing mechanisms
- Template method pattern in `_PollLikeSelector`
- Graceful degradation from high-performance to universally available selectors
- Consistent error handling with `InterruptedError` catching in all `select()` methods