# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/pin-project-lite-0.2.16/tests/expand/naming/struct-none.expanded.rs
@source-hash: 437332ba78e77ddf
@generated: 2026-02-09T18:02:36Z

## Purpose
This file contains macro-expanded code demonstrating the output of the `pin_project_lite` macro for a struct with no custom naming configuration. It shows the complete generated implementation for safe pinning projections of a generic struct.

## Key Components

### Original Struct (L2-5)
- `Struct<T, U>`: Generic struct with `pinned: T` and `unpinned: U` fields
- Represents the user-defined type that needs pin projection capabilities

### Generated Projection Types
- `Projection<'__pin, T, U>` (L30-36): Mutable projection struct containing pinned and unpinned field references
  - `pinned`: Wrapped in `Pin<&'__pin mut T>` for safe pinned access
  - `unpinned`: Regular `&'__pin mut U` reference since unpinned
- `ProjectionRef<'__pin, T, U>` (L50-56): Immutable projection struct for shared references
  - Similar structure but with immutable references

### Core Implementation Methods (L57-84)
- `project()` (L60-70): Safely projects pinned struct into mutable field references
  - Uses `get_unchecked_mut()` within `unsafe` block for performance
  - Wraps pinned field in `Pin::new_unchecked()`
- `project_ref()` (L73-83): Immutable version using `get_ref()` and shared references

### Safety Infrastructure
- `__Origin<'__pin, T, U>` (L86-90): Helper struct for Unpin analysis
  - Uses `PhantomData` for lifetime tracking
  - Wraps unpinned field in `AlwaysUnpin<U>` marker
- Conditional `Unpin` implementation (L91-96): Auto-implements `Unpin` when safe
- `MustNotImplDrop` trait (L97-100): Compile-time check preventing manual `Drop` implementation
- `__assert_not_repr_packed` (L102-105): Ensures struct isn't `#[repr(packed)]` for safety

## Architectural Patterns
- **Zero-cost abstraction**: All projection logic compiles to direct field access
- **Lifetime safety**: Uses `'__pin` lifetime to tie projections to original pinned reference
- **Unsafe encapsulation**: Hides `unsafe` operations behind safe projection methods
- **Compile-time validation**: Multiple trait bounds and assertions prevent misuse

## Dependencies
- `pin_project_lite::__private`: Internal utilities for Pin operations, PhantomData, AlwaysUnpin
- Standard library Pin APIs for safe pinned memory management