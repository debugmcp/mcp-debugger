# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/mio-1.1.0/src/sys/unix/waker/pipe.rs
@source-hash: 3705750619cd0d65
@generated: 2026-02-09T17:58:18Z

**Purpose:** Unix pipe-based waker implementation for the Mio async I/O library, providing cross-thread signaling mechanism for event loop wake-ups.

**Core Components:**
- `Waker` struct (L19-22): Contains sender and receiver `File` handles for a Unix pipe
- `new()` (L26-30): Creates waker and registers receiver with selector for given token
- `new_unregistered()` (L32-37): Creates waker without selector registration using `pipe::new_raw()`
- `wake()` (L39-58): Writes single byte to sender pipe with robust error handling and retry logic
- `ack_and_reset()` (L61-63): Empties pipe buffer (poll implementation specific)
- `empty()` (L67-75): Drains receiver pipe buffer in 4KB chunks until empty

**Key Dependencies:**
- `crate::sys::unix::pipe` for raw pipe creation
- `crate::sys::Selector` for event registration
- Platform-specific fd traits (`std::os::fd` or `std::os::hermit::io`)

**Architecture Patterns:**
- Cross-platform fd handling via conditional compilation (L3-8)
- Defensive programming: pipe buffer management to handle full buffers
- Recursive retry pattern in `wake()` with specific error handling for `WouldBlock` and `Interrupted`

**Platform-Specific Behavior:**
- illumos: Requires empty buffer before wake for edge-triggered events (L44-45)
- Hermit OS: Uses separate fd module (L7-8, TODO references Rust issue #126198)

**Critical Invariants:**
- Sender/receiver pair must remain synchronized
- Buffer must be drained on `WouldBlock` to prevent deadlock
- Single-byte wake signal maintains minimal overhead
- `AsRawFd` implementation (L78-82) exposes receiver fd for selector registration