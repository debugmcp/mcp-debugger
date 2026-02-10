# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/io/split.rs
@source-hash: c938755f089a2b13
@generated: 2026-02-09T18:06:42Z

## Purpose
Provides functionality to split a single stream implementing both `AsyncRead + AsyncWrite` into separate readable and writable handles, enabling concurrent read/write operations on the same underlying stream.

## Key Types

### Core Structs
- **`ReadHalf<T>` (L18-20)**: Read-only handle containing shared reference to inner stream wrapper
- **`WriteHalf<T>` (L23-25)**: Write-only handle containing shared reference to inner stream wrapper  
- **`Inner<T>` (L53-56)**: Thread-safe wrapper containing mutex-protected stream and cached write vectored capability

### Primary Function
- **`split<T>(stream: T) -> (ReadHalf<T>, WriteHalf<T>)` (L32-50)**: Main entry point that wraps stream in Arc<Inner<T>> and returns paired halves

## Key Implementation Details

### Thread Safety & Synchronization
- Uses `Arc<Inner<T>>` for shared ownership between read/write halves
- `Mutex<T>` protects the underlying stream from concurrent access (L54)
- `with_lock()` helper (L59-66) provides safe pinned access to the mutex-guarded stream

### Trait Implementations
- **`AsyncRead` for `ReadHalf<T>` (L110-118)**: Delegates to underlying stream via mutex lock
- **`AsyncWrite` for `WriteHalf<T>` (L120-149)**: Implements all write methods by delegating through mutex
- Caches `is_write_vectored` capability at split time for performance (L36, L146-148)

### Reunification
- **`is_pair_of()` methods (L72-73, L105-107)**: Check if halves originated from same split using `Arc::ptr_eq`
- **`unsplit()` method (L84-99)**: Reunites paired halves back into original stream, panics if halves are unrelated
- Requires `T: Unpin` constraint for unsplit operation

## Architectural Patterns
- **Shared ownership pattern**: Both halves hold `Arc` references to same inner wrapper
- **Mutex coordination**: Single mutex serializes all I/O operations despite separate handles
- **Capability caching**: Write vectored support determined once at split time
- **Panic-on-misuse**: Runtime validation that halves belong together

## Safety Considerations
- Uses `unsafe { Pin::new_unchecked() }` (L63) with safety comment ensuring stream isn't moved
- Manual `Send`/`Sync` implementations (L151-154) based on underlying type's thread safety
- Arc reference counting ensures memory safety across concurrent usage