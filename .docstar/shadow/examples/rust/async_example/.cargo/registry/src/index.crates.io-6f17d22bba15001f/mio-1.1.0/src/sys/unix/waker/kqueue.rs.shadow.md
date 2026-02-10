# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/mio-1.1.0/src/sys/unix/waker/kqueue.rs
@source-hash: 8794269a3533d016
@generated: 2026-02-09T17:58:15Z

## Primary Purpose
Unix-specific Waker implementation using kqueue's EVFILT_USER mechanism for cross-thread event notifications in the mio async I/O library.

## Key Components

### Waker Struct (L13-16)
- **Fields:**
  - `selector: Selector` (L14): Cloned kqueue selector for event operations
  - `token: Token` (L15): Unique identifier for waker events
- **Visibility:** `pub(crate)` - internal to mio crate
- **Derives:** Debug for diagnostic output

### Constructor (L19-23)
- `new(selector: &Selector, token: Token) -> io::Result<Waker>`
- Clones the provided selector via `try_clone()` (L20)
- Calls `setup_waker(token)` to configure kqueue for user events (L21)
- Returns initialized Waker instance on success

### Wake Method (L25-27)
- `wake(&self) -> io::Result<()>`
- Delegates to `selector.wake(self.token)` to trigger event
- Thread-safe operation for cross-thread signaling

## Dependencies
- `std::io` for Result types and error handling
- `crate::sys::Selector` for kqueue operations
- `crate::Token` for event identification

## Architecture Notes
- Part of platform-specific waker implementations (Unix/kqueue variant)
- Encapsulates kqueue EVFILT_USER complexity behind simple wake interface
- Selector cloning enables independent waker usage across threads
- Token-based identification allows multiple wakers per selector

## Usage Pattern
1. Create waker with selector reference and unique token
2. Call `wake()` from any thread to signal waiting selector
3. Selector receives user event identified by token