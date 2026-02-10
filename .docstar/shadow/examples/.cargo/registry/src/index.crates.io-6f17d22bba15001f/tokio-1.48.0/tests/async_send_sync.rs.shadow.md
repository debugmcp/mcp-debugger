# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/async_send_sync.rs
@source-hash: b7ba1ef28da9363b
@generated: 2026-02-09T18:12:23Z

## Test Suite for Tokio Async Send/Sync/Unpin Trait Verification

This is a comprehensive test file that validates the Send, Sync, and Unpin trait implementations across Tokio's async ecosystem using compile-time checks.

### Primary Purpose
Compile-time verification that Tokio types and async functions correctly implement or don't implement the Send, Sync, and Unpin traits based on their generic parameters and internal composition.

### Test Helper Types & Infrastructure

**Test Types (L16-32):**
- `YY` - Send + Sync (contains no interior mutability or non-Send types)
- `YN` - Send but !Sync (contains `Cell<u8>` for interior mutability)  
- `NN` - !Send + !Sync (contains `Rc<u8>` which is neither Send nor Sync)

**Type Aliases (L34-46):**
- `BoxFutureSync<T>`, `BoxFutureSend<T>`, `BoxFuture<T>` - Boxed futures with different trait bounds
- `BoxAsyncRead`, `BoxAsyncSeek`, `BoxAsyncWrite` - Boxed async I/O traits

**Trait Testing Infrastructure (L48-77):**
- `require_send`, `require_sync`, `require_unpin` - Functions that require specific traits
- `AmbiguousIfSend`, `AmbiguousIfSync`, `AmbiguousIfUnpin` - Traits that create compilation ambiguity when the target type implements the tested trait

### Core Testing Macros

**`async_assert_fn` (L111-122):**
The primary macro for testing async functions. Takes a function path with arguments and trait requirements (Send/Sync/Unpin patterns), then verifies the returned future implements the expected traits.

**`assert_value` (L123-134):**
Tests types directly for Send/Sync/Unpin implementation without async context.

**Platform-specific macro `cfg_not_wasi` (L136-143):**
Conditionally compiles tests that don't work on WebAssembly System Interface.

### Test Coverage by Module

**File System (`fs` mod, L161-203):**
Tests all `tokio::fs` types and async functions. Most async operations are Send + Sync but !Unpin.

**Networking (L205-243):**
- TCP types: TcpListener, TcpStream and associated types are Send + Sync + Unpin
- UDP types (L226-240): Similar trait implementations as TCP
- Unix domain sockets (L244-270): Platform-specific networking primitives

**Process Management (L306-319):**
Tests `tokio::process` types - Child processes and I/O handles are Send + Sync + Unpin.

**Signal Handling (L321-335):**
Platform-specific signal handling primitives with appropriate trait bounds.

**Synchronization Primitives (L337-536):**
Extensive testing of `tokio::sync` types including:
- Mutexes, RwLocks with different generic parameters showing how trait bounds propagate
- Channels (mpsc, broadcast, oneshot, watch) with type parameter variance
- Semaphores, barriers, and notification primitives

**Task Management (L453-555):**
- JoinHandle, JoinSet trait bounds depend on the task's return type
- LocalSet and LocalKey are !Send + !Sync due to thread-local nature

**Runtime Components (L557-561):**
Runtime, Builder, Handle are Send + Sync + Unpin for multi-threaded usage.

**Time Utilities (L562-580):**
Sleep, timeouts, intervals - generally Send + Sync with mixed Unpin behavior.

**I/O Utilities (L581-731):**
Comprehensive testing of async I/O traits and implementations, including buffered I/O, splitting, and extension trait methods.

**Platform-specific Modules:**
- Unix AsyncFd (L734-770): File descriptor integration with different trait bounds
- Unstable features (L772-778): LocalRuntime is !Send + !Sync

### Key Architectural Patterns

1. **Trait Propagation**: Generic types inherit Send/Sync bounds from their type parameters
2. **Interior Mutability Impact**: Types with `Cell` are Send but !Sync
3. **Reference Counting Impact**: Types with `Rc` are !Send + !Sync  
4. **Future Pinning**: Most async operations return !Unpin futures
5. **Platform Abstractions**: Conditional compilation for platform-specific features

The file serves as both documentation and verification that Tokio's async ecosystem maintains correct trait bounds for safe concurrent programming.