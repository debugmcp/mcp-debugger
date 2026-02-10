# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/selectors.py
@source-hash: 1eeb102373e18c96
@generated: 2026-02-09T18:13:05Z

## I/O Multiplexing Selector Module

**Primary Purpose:** High-level I/O multiplexing abstraction built on Python's `select` module primitives. Provides cross-platform selector implementations that monitor multiple file descriptors for I/O readiness events.

**Core Architecture:**
- **Event Constants (L17-18):** `EVENT_READ`/`EVENT_WRITE` bitfield flags for monitoring file descriptor states
- **SelectorKey (L46):** Named tuple container for registered file object metadata (fileobj, fd, events, data)
- **BaseSelector (L80-204):** Abstract base class defining selector interface with register/unregister/select operations
- **_BaseSelectorImpl (L206-288):** Concrete base implementation with fd-to-key mapping and common functionality

**Selector Implementations:**
- **SelectSelector (L290-339):** Uses `select.select()` with separate read/write fd sets. Win32-specific handling for exception events (L312-317)
- **_PollLikeSelector (L341-429):** Base class for poll/epoll/devpoll with shared timeout handling and event translation
- **PollSelector (L433-437):** Poll-based implementation (if available)
- **EpollSelector (L442-486):** Linux epoll implementation with optimized timeout handling and max events calculation
- **DevpollSelector (L490-502):** Solaris /dev/poll implementation
- **KqueueSelector (L506-586):** BSD kqueue implementation with manual kevent management and event counting

**Key Components:**
- **_fileobj_to_fd() (L21-43):** Converts file objects to file descriptors with validation
- **_SelectorMapping (L60-78):** Read-only mapping interface for registered file objects
- **_fileobj_lookup() (L215-232):** Enhanced fd lookup with exhaustive search fallback for closed objects
- **_can_use() (L588-608):** Runtime selector capability detection with OS/kernel support verification

**Selection Logic:**
- **DefaultSelector (L614-623):** Automatically chooses best available implementation (kqueue > epoll > devpoll > poll > select)
- **Platform Optimization:** Preferential ordering based on performance characteristics and fd limit constraints
- **Error Handling:** Graceful degradation and InterruptedError recovery in all implementations

**Key Patterns:**
- Abstract factory pattern for selector instantiation
- Template method pattern in _PollLikeSelector for shared poll-like behavior  
- Context manager support (__enter__/__exit__) for resource cleanup
- Defensive programming with exhaustive fd searches for closed file objects

**Critical Invariants:**
- All selectors maintain fd-to-key mapping consistency
- Event masks are validated against EVENT_READ|EVENT_WRITE
- File descriptor uniqueness enforced across registrations
- Timeout handling normalized across implementations (None=block, ≤0=non-block, >0=timed)