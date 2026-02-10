# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/signal/reusable_box.rs
@source-hash: 3d3b710b1794d9f8
@generated: 2026-02-09T18:06:42Z

**Purpose**: Memory-efficient boxed future container that can reuse allocations when replacing futures of compatible layout.

**Core Structure**:
- `ReusableBoxFuture<T>` (L13-15): Wrapper around `NonNull<dyn Future<Output = T> + Send>` that manages boxed futures with allocation reuse optimization

**Key Methods**:
- `new<F>()` (L19-31): Constructor that boxes a future and converts to NonNull pointer
- `set<F>()` (L37-44): Replaces stored future, falling back to reallocation if layouts differ
- `try_set<F>()` (L51-71): Attempts non-allocating future replacement, returns Err if layouts incompatible
- `set_same_layout<F>()` (L79-104): Unsafe in-place future replacement with panic-safe destructor handling
- `get_pin()` (L107-111): Returns pinned reference to stored future
- `poll()` (L114-116): Polls the stored future

**Safety Design**:
- Uses `NonNull` to maintain pointer validity guarantees
- Layout comparison (L61) ensures memory safety during in-place replacement
- Panic handling (L84-86, L98-103) prevents unwinding during destructor calls
- Proper vtable updates (L95) when casting between concrete and trait types

**Trait Implementations**:
- `Future` (L119-126): Delegates to stored future's poll method
- `Send/Sync` (L129-134): Manually implemented with safety justification
- `Unpin` (L137): Always safe like `Pin<Box<dyn Future>>`
- `Drop` (L139-145): Reconstructs Box for proper deallocation

**Memory Optimization**: Avoids reallocation when new future has same size/alignment as current future, reducing heap pressure in future replacement scenarios.

**Dependencies**: Standard library types for allocation (`Layout`), async (`Future`, `Pin`, `Poll`), and panic handling (`AssertUnwindSafe`, `catch_unwind`).