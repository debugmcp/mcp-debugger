# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/mio-1.1.0/src/io_source.rs
@source-hash: c484919d3a1ba025
@generated: 2026-02-09T18:11:41Z

## Purpose
Generic adapter for raw file descriptors (Unix/WASI/Hermit) and raw sockets (Windows) to provide Mio's `event::Source` implementation. Enables registration of arbitrary I/O resources with Mio's event loop while maintaining platform independence.

## Core Components

### IoSource<T> (L37-42)
Generic wrapper struct containing:
- `state: IoSourceState` - platform-specific I/O state management
- `inner: T` - the wrapped I/O resource (must implement `AsRawFd` or `AsRawSocket`)
- `selector_id: SelectorId` - debug-only association tracking with selectors

### Key Methods
- `new(io: T)` (L46-53) - Constructor wrapping any I/O resource
- `do_io<F, R>(&self, f: F)` (L65-70) - **Critical method** for all I/O operations, ensures proper state management after `WouldBlock` errors
- `into_inner(self)` (L80-82) - Extracts wrapped resource, dropping Mio state

### Deref Implementations (L89-105)
Provides direct access to wrapped resource with warnings that all blocking I/O must go through `do_io()`.

## Platform-Specific event::Source Implementations

### Unix/Hermit (L108-141)
- Constraint: `T: AsRawFd`
- Uses `inner.as_raw_fd()` for registration
- Full delegation to `self.state` methods

### Windows (L144-176)
- Constraint: `T: AsRawSocket`  
- Uses `inner.as_raw_socket()` for registration
- Notable: `reregister()` (L168) and `deregister()` (L174) don't pass socket handle to state

### WASI (L179-214)
- Constraint: `T: AsRawFd`
- Direct delegation to `registry.selector()` methods
- Casts raw fd with `as _`

## Debug Infrastructure

### SelectorId (L228-298, debug_assertions only)
Tracks association between I/O sources and registries to prevent double-registration:
- `UNASSOCIATED` constant (L236) - unregistered state marker
- `associate()` (L247-259) - atomic swap to establish registry association
- `check_association()` (L264-281) - validates current association
- `remove_association()` (L285-297) - atomic cleanup of association

## Dependencies
- Platform-specific raw handle traits (`AsRawFd`, `AsRawSocket`)
- `crate::sys::IoSourceState` - platform-specific I/O state management
- `crate::{event, Interest, Registry, Token}` - Mio event system types

## Critical Design Patterns
1. **Mandatory I/O Wrapper**: All potentially blocking operations must use `do_io()` to maintain proper event state
2. **Platform Abstraction**: Conditional compilation provides unified interface across Unix, Windows, WASI, and Hermit
3. **Debug Safety**: Runtime association tracking prevents registration errors in debug builds
4. **Zero-cost Abstraction**: Generic wrapper with no runtime overhead beyond debug assertions