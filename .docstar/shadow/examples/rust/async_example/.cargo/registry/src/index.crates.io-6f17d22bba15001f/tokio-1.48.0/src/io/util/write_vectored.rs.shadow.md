# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/io/util/write_vectored.rs
@source-hash: 7a335a9f796daa04
@generated: 2026-02-09T18:02:49Z

## Purpose
Provides a Future-based wrapper for vectored (scatter-gather) write operations on AsyncWrite streams, enabling efficient batch writing of multiple buffers.

## Key Components

### WriteVectored Struct (L14-20)
Future that wraps a mutable reference to an AsyncWrite object and a slice of IoSlice buffers. Uses pin projection to maintain !Unpin semantics for async trait compatibility. Generic over writer type W and two lifetimes: 'a for writer/buffer slice references, 'b for buffer data.

### write_vectored Constructor (L23-35) 
Factory function creating WriteVectored instances. Requires W: AsyncWrite + Unpin + ?Sized bounds. Takes mutable writer reference and IoSlice buffer array, returns configured future.

### Future Implementation (L37-47)
Implements Future trait with io::Result<usize> output (bytes written). The poll method (L43-46) projects self to access inner fields, then delegates to writer's poll_write_vectored method with context and buffers.

## Dependencies
- tokio::io::AsyncWrite - Core async write trait
- pin_project_lite - Macro for safe pin projection
- std::io - Standard I/O types and IoSlice
- std::task - Future polling infrastructure

## Architecture Notes
- Uses pin projection pattern for memory safety with self-referential futures
- PhantomPinned ensures !Unpin to prevent accidental moves
- Designed as single-use future (consumes buffers on completion)
- Integrates with tokio's async I/O ecosystem through AsyncWrite trait