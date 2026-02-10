# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/proc-macro2-1.0.103/src/rcvec.rs
@source-hash: a159d246cac59aae
@generated: 2026-02-09T18:11:42Z

**Purpose**: Reference-counted vector implementation providing efficient shared ownership with copy-on-write semantics for proc-macro2 token storage.

**Core Architecture**:
- **RcVec<T>** (L7-9): Main shared vector wrapper around `Rc<Vec<T>>` for efficient cloning
- **RcVecBuilder<T>** (L11-13): Mutable builder for constructing RcVec instances
- **RcVecMut<'a, T>** (L15-17): Temporary mutable access wrapper with lifetime constraint
- **RcVecIntoIter<T>** (L19-22): Iterator wrapper for consuming iteration

**Key Operations**:

*RcVec methods (L24-62)*:
- `is_empty()`, `len()`, `iter()` (L25-35): Standard read-only operations
- `make_mut()` (L37-44): Copy-on-write mutation via `Rc::make_mut`, requires `T: Clone`
- `get_mut()` (L46-49): Non-copying mutable access if no other references exist
- `make_owned()` (L51-61): Converts to builder, optimized to avoid cloning when sole owner

*RcVecBuilder methods (L64-94)*:
- `new()`, `with_capacity()` (L65-73): Standard constructors
- `push()`, `extend()` (L75-81): Mutable operations
- `as_mut()` (L83-87): Temporary mutable access wrapper
- `build()` (L89-93): Consumes builder to create final RcVec

*RcVecMut methods (L96-113)*:
- `push()`, `extend()` (L97-103): Direct mutation operations
- `take()` (L109-112): Extracts owned Vec as builder via `mem::take`

**Trait Implementations**:
- `Clone` for RcVec (L115-121): Efficient Rc cloning, not data cloning
- `IntoIterator` for RcVecBuilder (L123-132): Consuming iteration
- `Iterator` for RcVecIntoIter (L134-144): Standard iterator protocol
- `RefUnwindSafe` for RcVec (L146): Panic safety marker

**Design Pattern**: Builder pattern with copy-on-write optimization for shared immutable data with occasional mutations, typical for AST node storage in proc macros.