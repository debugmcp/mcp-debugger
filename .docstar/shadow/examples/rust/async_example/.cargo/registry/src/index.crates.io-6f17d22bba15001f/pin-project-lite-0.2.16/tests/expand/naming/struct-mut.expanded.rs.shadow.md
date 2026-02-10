# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/pin-project-lite-0.2.16/tests/expand/naming/struct-mut.expanded.rs
@source-hash: d7f0c80f787de540
@generated: 2026-02-09T18:03:18Z

## Purpose
This is a macro-expanded test file demonstrating the generated code from `pin_project_lite` macro for a struct with mutable projection. It shows how the macro transforms a simple struct into a complex implementation that supports safe pinning semantics.

## Core Structure
- **Struct<T, U>** (L2-5): Original generic struct with `pinned: T` and `unpinned: U` fields
- **StructProj<'__pin, T, U>** (L19-25): Mutable projection struct where `pinned` field becomes `Pin<&'__pin mut T>` and `unpinned` becomes `&'__pin mut U`
- **ProjectionRef<'__pin, T, U>** (L50-56): Immutable projection struct where both fields become immutable references

## Key Methods
- **project()** (L60-70): Creates mutable projection from `Pin<&mut Self>`, using `get_unchecked_mut()` and `Pin::new_unchecked()` for the pinned field
- **project_ref()** (L73-83): Creates immutable projection from `Pin<&Self>`, using `get_ref()` and maintaining pin guarantees

## Pin Safety Infrastructure
- **__Origin<'__pin, T, U>** (L86-90): Phantom type for Unpin analysis, wraps `unpinned` field in `AlwaysUnpin<U>`
- **Unpin implementation** (L91-96): Conditional Unpin based on `PinnedFieldsOf<__Origin>` being Unpin
- **MustNotImplDrop trait** (L97-100): Ensures the original struct doesn't implement Drop (pin safety requirement)
- **__assert_not_repr_packed()** (L102-105): Compile-time check preventing `#[repr(packed)]` usage

## Architectural Patterns
- Uses `const _: () = { ... }` block to scope generated code
- Extensive `#[allow]` attributes suppress clippy warnings on generated code
- All projections use lifetime `'__pin` for borrow tracking
- Unsafe code isolated to projection methods with proper pin guarantees

## Dependencies
- `pin_project_lite`: Core macro and runtime support (`__private` module)
- Standard library: `PhantomData`, `Pin`, `Drop` trait

## Critical Invariants
- Pinned fields must never be moved after pinning
- Only safe to create projections through provided methods
- Drop implementation forbidden on pinnable structs
- Packed representation forbidden for memory safety