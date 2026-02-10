# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/pin-project-lite-0.2.16/tests/expand/default/struct.expanded.rs
@source-hash: 437332ba78e77ddf
@generated: 2026-02-09T18:03:21Z

## Purpose
Generated macro-expanded code from pin-project-lite for a struct with mixed pinned/unpinned fields. This is test output showing how the pin_project macro transforms a basic struct definition into a complete pin projection implementation.

## Key Components

### Original Struct Definition (L2-5)
- `Struct<T, U>` with generic types T and U
- `pinned: T` field intended for pin projection  
- `unpinned: U` field that remains unpinned

### Generated Projection Types
- **Projection<'__pin, T, U>** (L30-36): Mutable projection with `Pin<&mut T>` for pinned field, `&mut U` for unpinned
- **ProjectionRef<'__pin, T, U>** (L50-56): Immutable projection with `Pin<&T>` for pinned field, `&U` for unpinned

### Core Implementation Methods (L57-84)
- **project()** (L60-70): Converts `Pin<&mut Self>` → `Projection`, uses unsafe `get_unchecked_mut()` and `Pin::new_unchecked()`
- **project_ref()** (L73-83): Converts `Pin<&Self>` → `ProjectionRef`, uses unsafe `get_ref()` and `Pin::new_unchecked()`

### Pin Safety Infrastructure (L85-106)
- **__Origin<'__pin, T, U>** (L86-90): Helper struct with `AlwaysUnpin<U>` wrapper for unpinned fields
- **Unpin implementation** (L91-96): Conditional Unpin based on `PinnedFieldsOf<__Origin>`
- **MustNotImplDrop trait** (L97-100): Prevents manual Drop implementations that could break pin guarantees
- **__assert_not_repr_packed()** (L102-105): Compile-time check ensuring struct isn't `#[repr(packed)]`

## Architecture Patterns
- Uses anonymous const block (L16-106) to scope generated code
- Extensive clippy allow attributes to suppress linter warnings on generated code
- Unsafe blocks isolated to projection methods with careful field-by-field handling
- PhantomData for lifetime management in __Origin struct

## Critical Safety Invariants
- Pin projection maintains pinning guarantee: pinned fields stay pinned through projections
- Structural pinning: Unpin only when all pinned fields are Unpin
- Drop safety: Prevents Drop implementations that could move pinned data
- Memory layout: Ensures no packed representation that could create unaligned references