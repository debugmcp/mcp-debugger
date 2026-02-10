# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/context/scoped.rs
@source-hash: 16bfa1da16baa831
@generated: 2026-02-09T18:03:05Z

## Primary Purpose
Provides scoped thread-local storage functionality for temporarily storing values during closure execution. The `Scoped<T>` type enables RAII-style management of thread-local context that automatically restores previous values when scope exits.

## Key Components

**Scoped<T> struct (L5-7)**: Main container with a `Cell<*const T>` that stores a raw pointer to the current scoped value. Uses `Cell` for interior mutability on single-threaded access.

**new() constructor (L10-14)**: Creates a new `Scoped<T>` instance initialized with a null pointer, marked as `const fn` for compile-time initialization.

**set() method (L17-41)**: Core functionality that temporarily sets a value for the duration of a closure:
- Takes a reference to value `t` and closure `f`
- Stores previous pointer value (L32)
- Sets new pointer (L33) 
- Uses RAII guard `Reset` (L21-30) to automatically restore previous value on drop
- Executes closure and returns its result (L40)

**Reset guard struct (L21-30)**: Drop guard that ensures previous scoped value is restored when leaving scope. Contains reference to the cell and previous pointer value.

**with() method (L44-55)**: Safely accesses current scoped value:
- Retrieves current pointer (L48)
- Calls closure with `None` if null (L51) or `Some(&T)` if valid (L53)
- Uses unsafe dereference since pointer validity is managed by `set()`

## Architecture & Patterns

- **RAII Pattern**: Uses drop guards to ensure automatic cleanup
- **Scoped Context**: Provides lexical scoping for thread-local values
- **Raw Pointer Management**: Uses `*const T` with manual lifetime management
- **Interior Mutability**: `Cell` allows mutation within shared references

## Safety Invariants

- Pointers stored in `inner` are only valid during their corresponding `set()` scope
- `with()` method assumes non-null pointers reference valid memory
- Thread-local access only - not thread-safe for concurrent access
- Lifetime of referenced values must outlive the `set()` scope