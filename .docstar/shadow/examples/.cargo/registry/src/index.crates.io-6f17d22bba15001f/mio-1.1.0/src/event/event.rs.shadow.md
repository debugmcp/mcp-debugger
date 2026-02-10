# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/mio-1.1.0/src/event/event.rs
@source-hash: 93539254a5d472b5
@generated: 2026-02-09T18:06:23Z

**Primary Purpose**: Core event abstraction for Mio's event-driven I/O system. Wraps platform-specific event structures and provides a unified interface for checking I/O readiness states returned by `Poll::poll`.

**Key Structure**:
- `Event` (L15-19): Transparent wrapper around platform-specific `sys::Event` with `#[repr(transparent)]` for zero-cost abstraction

**Core Methods**:
- `token()` (L23-25): Returns the `Token` identifier associated with this event
- `is_readable()` (L37-39): Checks for readable readiness, includes OOB data handling notes
- `is_writable()` (L42-44): Checks for writable readiness  
- `is_error()` (L67-69): Platform-agnostic error detection (epoll: `EPOLLERR`, kqueue: `EV_ERROR`/`EV_EOF`)
- `is_read_closed()` (L98-100): Detects read-half socket closure with platform-specific implementations
- `is_write_closed()` (L128-130): Detects write-half socket closure, behavior varies by platform
- `is_priority()` (L150-152): Priority data readiness (epoll: `EPOLLPRI`, kqueue: not supported)
- `is_aio()` (L172-174): Async I/O readiness (kqueue on BSD/macOS only)
- `is_lio()` (L182-184): List I/O readiness (FreeBSD only)

**Internal Interface**:
- `from_sys_event_ref()` (L187-193): Unsafe conversion from system event reference using pointer casting

**Debug Implementation** (L202-230):
- Standard debug output with all readiness flags
- Alternate format includes platform-specific details via `sys::event::debug_details`
- Uses nested `EventDetails` wrapper for platform-specific formatting

**Dependencies**:
- `crate::sys`: Platform-specific event implementations
- `crate::Token`: Event identifier type
- `std::fmt`: Debug formatting support

**Architecture Notes**:
- Zero-cost abstraction over platform event systems (epoll/kqueue)
- Extensive cross-platform compatibility documentation with flag mapping tables
- Best-effort implementations for features not available on all platforms
- Edge-triggered semantics prevent DoS vulnerabilities mentioned in OOB data handling

**Critical Constraints**:
- Memory layout must match `sys::Event` exactly due to `repr(transparent)`
- Platform-specific behavior documented extensively for portability
- Some readiness checks are best-effort and may not trigger on all platforms