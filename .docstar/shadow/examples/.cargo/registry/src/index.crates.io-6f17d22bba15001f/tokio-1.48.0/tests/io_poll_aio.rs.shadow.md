# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/io_poll_aio.rs
@source-hash: 105157ff385b5991
@generated: 2026-02-09T18:12:24Z

## Purpose
Test file demonstrating BSD AIO (Asynchronous I/O) integration with Tokio on FreeBSD. Provides comprehensive examples of both high-level (`mio_aio`) and low-level (`libc`) AIO operations integrated with Tokio's async runtime.

## Key Modules & Types

### `aio` Module (L17-193)
Core AIO functionality testing with multiple implementation approaches:

**TokioSource (L21)** - Wrapper around `mio_aio::Source<AioFsync>` implementing `AioSource` trait
- `register()` (L24-26): Registers AIO source with kqueue using raw fd/token
- `deregister()` (L27-29): Unregisters from kqueue

**FsyncFut (L33)** - High-level async fsync future wrapping `Aio<TokioSource>`
- `submit()` (L36-42): Submits fsync operation to kernel
- `poll()` (L48-64): Future implementation handling completion via `poll_ready()` and `aio_return()`

**LlSource (L71)** - Low-level AIO source using raw `libc::aiocb`
- `fsync()` (L74-80): Direct `libc::aio_fsync` call
- `register()`/`deregister()` (L84-98): Manual `sigevent` setup for kqueue integration

**LlFut (L101)** - Low-level async future with manual readiness clearing
- `fsync()` (L104-107): Initiates fsync operation
- `poll()` (L113-132): Polls readiness and retrieves result via `libc::aio_return`

### `lio` Module (L195-339) 
`lio_listio` (list I/O) operation testing:

**LioSource (L203)** - Source for batch AIO operations
- `new()` (L209-214): Constructor taking array of `aiocb` pointers
- `submit()` (L216-221): Submits operation list via `libc::lio_listio`
- AioSource trait implementation (L225-240): kqueue registration with `sigevent`

**LioFut (L242)** - Future for list I/O operations
- `submit()` (L245-248): Initiates batch operation
- `poll()` (L254-281): Handles completion with readiness clearing, supports partial completion

## Test Cases

- **fsync() (L136-145)**: Basic fsync operation using high-level API
- **ll_fsync() (L148-162)**: Low-level fsync with direct libc calls
- **aio::reuse() (L166-192)**: Demonstrates Aio object reusability after readiness clearing
- **lio::onewrite() (L286-303)**: Single write operation via lio_listio
- **lio::reuse() (L307-338)**: Reuse pattern for list I/O operations

## Key Dependencies
- `mio_aio`: High-level AIO abstractions
- `tokio::io::bsd::{Aio, AioSource}`: Tokio BSD-specific AIO integration
- `libc`: Direct system call access for low-level operations
- Platform: FreeBSD only (`#![cfg(all(target_os = "freebsd", feature = "net"))]`)

## Architecture Notes
- Demonstrates three AIO integration patterns: mio_aio wrapper, direct libc, and lio_listio
- Showcases proper kqueue integration via `sigevent` structures
- Tests both one-shot and reusable future patterns
- Heavy use of `unsafe` for direct libc interaction and pinned memory management
- Proper cleanup via readiness clearing prevents future re-polling issues