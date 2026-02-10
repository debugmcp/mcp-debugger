# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/mio-1.1.0/src/sys/windows/iocp.rs
@source-hash: 480c1b05e9cb7e37
@generated: 2026-02-09T18:02:34Z

## Purpose and Responsibility
Windows-specific I/O Completion Port (IOCP) bindings for the MIO library. Provides a safe Rust interface to Windows' high-performance asynchronous I/O mechanism, enabling efficient polling of multiple I/O operations.

## Key Types

### CompletionPort (L20-22)
Main wrapper around Windows IOCP handle with thread-safe Send/Sync implementations (L26-30).

**Key Methods:**
- `new(threads: u32)` (L56-65) - Creates new IOCP with specified concurrency level
- `add_handle<T: AsRawHandle>(&self, token: usize, t: &T)` (L77-86) - Associates file handles with completion tokens (feature-gated)
- `get_many(&self, list: &mut [CompletionStatus], timeout: Option<Duration>)` (L97-125) - Bulk dequeue completion events with optional timeout
- `post(&self, status: CompletionStatus)` (L132-147) - Posts custom completion events

### CompletionStatus (L39)
Transparent wrapper around `OVERLAPPED_ENTRY` representing I/O completion events.

**Key Methods:**
- `new(bytes: u32, token: usize, overlapped: *mut Overlapped)` (L176-183) - Creates completion status for posting
- `zero()` (L202-204) - Creates empty status for buffer initialization
- `bytes_transferred()` (L208-210) - Returns transferred byte count
- `token()` (L217-219) - Returns completion key/token
- `overlapped()` (L223-225) - Returns overlapped structure pointer
- `from_entry(&OVERLAPPED_ENTRY)` (L191-196) - Zero-copy conversion (feature-gated)

## Dependencies and Relationships
- Uses `windows_sys` crate for raw Win32 API bindings (L12-16)
- Depends on local `Handle` and `Overlapped` types from parent module (L3)
- Implements standard traits: `AsRawHandle`, `FromRawHandle`, `IntoRawHandle` (L150-168)

## Utility Functions
- `duration_millis(dur: Option<Duration>)` (L234-248) - Converts duration to milliseconds with proper rounding for sub-millisecond timeouts

## Architectural Decisions
- Uses transparent repr for `CompletionStatus` to enable safe transmutation with `OVERLAPPED_ENTRY`
- Thread safety explicitly implemented via unsafe Send/Sync with safety comments justifying the decision
- Feature-gated functionality for different MIO configurations ("net", "os-ext")
- Bulk operations preferred (`get_many`) over individual polling for performance

## Critical Invariants
- `CompletionStatus` must remain layout-compatible with `OVERLAPPED_ENTRY` (L194-195)
- Size assertion in `get_many` ensures memory layout compatibility (L102-105)
- Handle operations return OS errors on Win32 API failures
- Timeout of `None` maps to infinite wait (`u32::MAX`) (L246)