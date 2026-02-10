# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/pin-project-lite-0.2.16/tests/expand/naming/struct-ref.expanded.rs
@source-hash: 8c5d5efc6f18f08c
@generated: 2026-02-09T18:02:36Z

## Purpose
Expanded macro output from `pin-project-lite` demonstrating the generated code for a struct with both pinned and unpinned fields. This is a test file showing the complete macro expansion for reference projections.

## Key Components

### Original Struct (L2-5)
- `Struct<T, U>`: Generic struct with `pinned: T` and `unpinned: U` fields
- Serves as the base type that gets pin-projection capabilities

### Generated Projection Types
- `StructProjRef<'__pin, T, U>` (L19-25): Immutable reference projection
  - `pinned`: `Pin<&'__pin T>` - pinned reference to T
  - `unpinned`: `&'__pin U` - regular reference to U
- `Projection<'__pin, T, U>` (L50-56): Mutable reference projection  
  - `pinned`: `Pin<&'__pin mut T>` - pinned mutable reference to T
  - `unpinned`: `&'__pin mut U` - regular mutable reference to U

### Projection Methods (L57-84)
- `project()` (L60-70): Returns mutable projection, uses `get_unchecked_mut()`
- `project_ref()` (L73-83): Returns immutable projection, uses `get_ref()`
- Both methods use `unsafe` blocks with `Pin::new_unchecked()`

### Pin Safety Infrastructure
- `__Origin<'__pin, T, U>` (L86-90): Helper struct for Unpin analysis
  - Uses `AlwaysUnpin<U>` wrapper for unpinned field
  - Contains `PhantomData` for lifetime tracking
- `Unpin` impl (L91-96): Conditional Unpin based on pinned fields only
- `MustNotImplDrop` trait (L97-100): Prevents manual Drop implementation
- `__assert_not_repr_packed()` (L102-105): Compile-time check against `#[repr(packed)]`

## Dependencies
- `pin_project_lite`: Core macro and runtime support
- `pin_project_lite::__private`: Internal utilities (Pin, PhantomData, AlwaysUnpin, etc.)

## Architecture Notes
- Generated code is wrapped in `const _: () = { ... }` block for hygiene
- Extensive lint allowances to suppress warnings on generated code
- Uses `'__pin` lifetime convention for macro-generated lifetimes
- Implements zero-cost projections through unsafe Pin manipulation
- Ensures Drop safety and repr(packed) compatibility through compile-time checks