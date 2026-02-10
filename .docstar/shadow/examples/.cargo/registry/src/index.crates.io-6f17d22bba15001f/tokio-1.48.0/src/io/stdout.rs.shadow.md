# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/io/stdout.rs
@source-hash: 3043d5790071870d
@generated: 2026-02-09T18:06:37Z

## Purpose
Tokio async wrapper for standard output stream, providing non-blocking write operations within the Tokio runtime.

## Key Components

### Stdout Struct (L62-64)
- Wraps `std::io::Stdout` in a `Blocking` adapter and `SplitByUtf8BoundaryIfWindows` wrapper
- Provides async interface to stdout via delegation to the wrapped blocking implementation
- Single field: `std: SplitByUtf8BoundaryIfWindows<Blocking<std::io::Stdout>>`

### stdout() Function (L117-126)
- Factory function that creates new `Stdout` instances
- Wraps `std::io::stdout()` in unsafe `Blocking::new()` call (with safety justification in comments)
- Applies Windows-specific UTF-8 boundary splitting via `SplitByUtf8BoundaryIfWindows::new()`

### AsyncWrite Implementation (L164-183)
- Delegates all async write operations to the wrapped `std` field
- `poll_write` (L165-171): Forwards write requests
- `poll_flush` (L173-175): Forwards flush requests  
- `poll_shutdown` (L177-182): Forwards shutdown requests

## Platform-Specific Traits

### Unix Support (L129-146)
- `AsRawFd` implementation (L135-139): Returns raw file descriptor from `std::io::stdout()`
- `AsFd` implementation (L141-145): Creates `BorrowedFd` from raw fd via unsafe borrow

### Windows Support (L148-162)
- `AsRawHandle` implementation (L151-155): Returns raw handle from `std::io::stdout()`
- `AsHandle` implementation (L157-161): Creates `BorrowedHandle` from raw handle via unsafe borrow

## Dependencies
- `crate::io::blocking::Blocking`: Async-to-blocking adapter
- `crate::io::stdio_common::SplitByUtf8BoundaryIfWindows`: Windows UTF-8 handling
- `crate::io::AsyncWrite`: Core async write trait

## Critical Constraints
- **Concurrency Warning**: Individual writes are atomic, but `write_all` operations may be split across multiple writes, causing interleaved output in concurrent scenarios
- **Thread Safety**: Each `Stdout` instance should be reused rather than creating new instances in loops to avoid mangled output from different blocking threads
- **Windows UTF-8 Handling**: Automatic boundary splitting prevents corrupted UTF-8 sequences on Windows

## Architectural Patterns
- Delegation pattern: All async operations forwarded to wrapped implementation
- Platform abstraction: Conditional compilation for Unix/Windows-specific traits
- Safety encapsulation: Unsafe operations isolated in factory function with detailed safety comments