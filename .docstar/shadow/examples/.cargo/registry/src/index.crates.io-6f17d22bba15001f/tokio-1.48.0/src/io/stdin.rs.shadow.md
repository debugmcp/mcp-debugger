# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/io/stdin.rs
@source-hash: 78f3be2900915a64
@generated: 2026-02-09T18:06:34Z

## Purpose
Tokio's async standard input implementation, providing non-blocking access to stdin through a blocking wrapper pattern.

## Key Components

### Stdin struct (L29-31)
- Wraps `std::io::Stdin` in `Blocking<T>` adapter for async compatibility
- Implements `AsyncRead` trait for non-blocking operations
- Contains single field `std: Blocking<std::io::Stdin>`

### Factory Function
- `stdin()` (L43-52): Creates new `Stdin` instance using unsafe `Blocking::new()` wrapper
- Safety comment indicates buffer handling correctness assumptions

### AsyncRead Implementation (L90-98)
- Delegates `poll_read` to wrapped `Blocking<std::io::Stdin>`
- Standard async read pattern with `Pin`, `Context`, and `ReadBuf` parameters

## Platform-Specific Extensions

### Unix Support (L55-72)
- `AsRawFd` implementation (L61-65): Exposes raw file descriptor
- `AsFd` implementation (L67-71): Provides borrowed file descriptor with unsafe `borrow_raw`

### Windows Support (L74-88)
- `AsRawHandle` implementation (L77-81): Exposes raw handle
- `AsHandle` implementation (L83-87): Provides borrowed handle with unsafe `borrow_raw`

## Dependencies
- `crate::io::blocking::Blocking`: Core async-to-blocking adapter
- `crate::io::{AsyncRead, ReadBuf}`: Async I/O traits
- Platform-specific handle/fd traits for resource access

## Architecture Notes
- Uses blocking thread pool approach for stdin access
- Cannot be cancelled once read operation starts (blocking nature)
- Recommended for non-interactive use cases (piped input)
- Interactive applications should use dedicated blocking threads

## Critical Constraints
- Shutdown can hang waiting for stdin input
- Concurrent reads require careful coordination
- Safety depends on `std::io::Stdin` buffer handling guarantees