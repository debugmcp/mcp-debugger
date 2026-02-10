# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/util/rc_cell.rs
@source-hash: 362a7a7b77638968
@generated: 2026-02-09T18:06:48Z

## RcCell - Reference-Counted Cell for Interior Mutability

A specialized cell type that wraps `Option<Rc<T>>` with interior mutability, providing methods to get and modify the contained `Rc` without requiring `Rc` to be `Copy`.

### Core Structure
- **RcCell<T>** (L7-9): Contains an `UnsafeCell<Option<Rc<T>>>` for interior mutability
- Uses `crate::loom::cell::UnsafeCell` for testing compatibility with loom's concurrency model

### Key Methods
- **new()** (L13-17, L21-25): Creates empty RcCell; const version for non-loom builds, regular fn for loom testing
- **with_inner()** (L29-39): Unsafe method providing exclusive access to inner `Option<Rc<T>>`; requires non-recursive call guarantee
- **get()** (L41-45): Returns cloned `Option<Rc<T>>` by leveraging `Rc::clone`
- **replace()** (L47-51): Atomically replaces inner value and returns old value
- **set()** (L53-56): Sets new value, properly dropping old value

### Safety Model
- Not `Sync` - prevents concurrent access to inner cell
- Relies on caller guarantees for non-recursive calls to `with_inner()`
- Uses `UnsafeCell::with_mut()` to create temporary exclusive mutable references
- Safety comments indicate careful reasoning about when user code might execute

### Dependencies
- `std::rc::Rc` for reference counting
- `crate::loom::cell::UnsafeCell` for loom-compatible unsafe cell operations
- Conditional compilation for loom testing vs production builds

### Usage Pattern
Designed as a drop-in replacement for `Cell<Option<Rc<T>>>` that provides `get()` method despite `Rc` not being `Copy`. Enables shared ownership patterns in single-threaded contexts with interior mutability.