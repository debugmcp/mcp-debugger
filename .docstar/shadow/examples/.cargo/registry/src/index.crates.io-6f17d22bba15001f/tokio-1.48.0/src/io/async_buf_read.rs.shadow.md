# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/io/async_buf_read.rs
@source-hash: b4c19705fcb2640f
@generated: 2026-02-09T18:06:35Z

## AsyncBufRead Trait Definition

Defines the core `AsyncBufRead` trait for asynchronous buffered reading in Tokio's I/O system. This trait provides non-blocking buffered read operations that integrate with the async task system.

### Core Trait

**AsyncBufRead (L23-63)**: Main trait extending `AsyncRead` with buffered reading capabilities. Provides two essential methods:
- `poll_fill_buf()` (L45): Returns internal buffer contents, polls for more data if empty. Returns `Poll::Ready(Ok(buf))` on success or `Poll::Pending` when no data available
- `consume()` (L62): Marks specified bytes as consumed from buffer to prevent re-reading

The trait follows async polling patterns - `poll_fill_buf` registers current task for wakeup when data unavailable, avoiding thread blocking.

### Implementation Strategy

**deref_async_buf_read! macro (L65-75)**: Code generation macro that implements `AsyncBufRead` for wrapper types by delegating to the inner type. Used for consistent delegation pattern across pointer-like types.

### Standard Implementations

**Box<T> (L77-79)**: AsyncBufRead for boxed types using delegation macro
**&mut T (L81-83)**: AsyncBufRead for mutable references using delegation macro  
**Pin<P> (L85-97)**: AsyncBufRead for pinned pointers, uses `pin_as_deref_mut` utility for safe pin manipulation
**&[u8] (L99-107)**: Direct implementation for byte slices - `poll_fill_buf` returns entire slice, `consume` advances slice position
**io::Cursor<T> (L109-117)**: Bridges std::io::BufRead to AsyncBufRead by wrapping synchronous operations

### Key Dependencies

- `AsyncRead` trait (required bound)
- `std::io` for Result types and Cursor
- `std::task::{Context, Poll}` for async polling
- `crate::util::pin_as_deref_mut` for Pin manipulation

### Design Patterns

- **Async Polling**: Uses `Poll<Result<T>>` return types for non-blocking operations
- **Pin Safety**: All methods take `Pin<&mut Self>` for memory safety in async contexts  
- **Zero-Copy**: Buffer access returns borrowed slices rather than copying data
- **Delegation**: Consistent pattern for implementing trait on wrapper types through macro

The trait enables efficient async buffered reading by exposing internal buffers directly while maintaining proper async task coordination.