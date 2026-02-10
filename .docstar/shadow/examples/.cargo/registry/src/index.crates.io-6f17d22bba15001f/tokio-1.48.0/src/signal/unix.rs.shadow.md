# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/signal/unix.rs
@source-hash: eee57eea61d4036f
@generated: 2026-02-09T18:06:52Z

## Purpose
Unix-specific signal handling implementation for Tokio runtime. Provides async signal listeners through the `Signal` struct and manages OS signal registration via a global signal handler system.

## Key Types

### SignalKind (L68-216)
Wrapper around `libc::c_int` representing Unix signal types. Provides const constructors for common signals:
- `interrupt()` (L146): SIGINT
- `hangup()` (L122): SIGHUP  
- `terminate()` (L189): SIGTERM
- `child()` (L114): SIGCHLD
- `alarm()`, `pipe()`, `quit()`, `user_defined1()`, `user_defined2()`, `window_change()`, etc.
- `from_raw()` (L87): Create from raw signal number
- `as_raw_value()` (L98): Get underlying signal number

### Signal (L375-377)  
Main async signal listener wrapping `RxFuture`. Methods:
- `recv()` (L456): Async receive next signal
- `poll_recv()` (L494): Poll-based receive for manual Future implementations

### Internal Storage Types
- `OsStorage` (L21): `Box<[SignalInfo]>` - signal storage array sized for platform (L24-36)
- `SignalInfo` (L230-244): Per-signal state with `EventInfo`, `Once` init guard, and `AtomicBool` status
- `OsExtraData` (L53-64): Unix socket pair for signal driver communication

## Key Functions

### signal() (L407-414)
Public API to create Signal listener. Gets current scheduler handle and calls `signal_with_handle()`.

### signal_with_handle() (L416-424) 
Internal Signal creation with explicit handle. Enables signal via `signal_enable()` then registers listener.

### signal_enable() (L268-305)
Core signal registration logic:
- Validates signal number against forbidden list
- Uses `Once` to ensure single registration per signal
- Registers via `signal_hook_registry::register()` with `action()` callback
- Sets atomic flag on successful registration

### action() (L254-261)
Global signal handler callback (async-signal-safe):
- Records signal event in globals
- Writes wake-up byte to Unix socket sender

## Architecture Patterns

**Global State Management**: Uses `globals()` to access singleton `Globals` instance containing signal storage and communication channels.

**Signal Coalescing**: Multiple signal deliveries between polls are coalesced into single notifications (documented L317-324).

**One-Time Registration**: Each signal type registered exactly once using `Once` guards, with process-wide handler installation.

**Driver Communication**: Signal handler communicates with async runtime via Unix socket pair in `OsExtraData`.

## Platform Specifics
- Standard Unix signals (1-33) on most platforms (L26-27)
- Extended real-time signals on Linux/illumos (L32-33)  
- Platform-specific signals like `SIGINFO` (L130-140) and `SIGIO`/`SIGPOLL` (L150-165)

## Dependencies
- `signal_hook_registry` for low-level signal registration
- `mio::net::UnixStream` for driver communication
- Internal tokio runtime and sync primitives

## Critical Invariants
- Signal handlers remain installed for process lifetime (L341-352)
- Signal registration is thread-safe via atomic flags and `Once` guards
- Handler must be async-signal-safe (only atomic ops and pipe writes)