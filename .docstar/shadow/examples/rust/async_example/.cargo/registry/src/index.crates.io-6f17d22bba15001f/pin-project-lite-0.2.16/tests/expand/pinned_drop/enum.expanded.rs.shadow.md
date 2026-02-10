# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/pin-project-lite-0.2.16/tests/expand/pinned_drop/enum.expanded.rs
@source-hash: 8776e664d0af9102
@generated: 2026-02-09T18:02:40Z

This file demonstrates the expanded macro output for `pin-project-lite` applied to an enum with pinned drop functionality. It's a test/example showing what the procedural macro generates.

## Primary Components

**Original Enum (L2-5)**: `Enum<T, U>` with two variants:
- `Struct` variant containing `pinned: T` and `unpinned: U` fields
- `Unit` variant with no fields

**Generated Projection Types**:
- `EnumProj<'__pin, T, U>` (L19-28): Mutable projection enum where `pinned` field becomes `Pin<&mut T>` and `unpinned` becomes `&mut U`
- `EnumProjRef<'__pin, T, U>` (L42-51): Immutable projection enum where `pinned` field becomes `Pin<&T>` and `unpinned` becomes `&T`

**Implementation Block (L61-100)**: Core projection methods for `Enum<T, U>`:
- `project()` (L64-80): Converts pinned enum to mutable projection using unsafe operations
- `project_ref()` (L83-99): Converts pinned enum to immutable projection using unsafe operations

**Unpin Implementation Support**:
- `__Origin<'__pin, T, U>` struct (L102-106): Helper type for Unpin trait bounds analysis
- Conditional `Unpin` impl (L107-112): Auto-implements `Unpin` based on field requirements
- Custom `Drop` impl (L113-126): Ensures proper drop semantics for pinned types with `__drop_inner` pattern

## Key Architecture Patterns

- **Safety**: All projections use `unsafe` operations with `Pin::new_unchecked()` and `get_unchecked_mut()`
- **Lifetime Management**: Uses `'__pin` lifetime to tie projections to original pinned reference
- **Clippy Suppression**: Extensive allow attributes to suppress macro-generated code warnings
- **Drop Safety**: Custom drop implementation ensures pinned drop semantics are preserved

## Dependencies

- `pin_project_lite` crate for Pin projection utilities
- Uses private APIs from `pin_project_lite::__private` module

This expanded code shows how `pin-project-lite` automatically generates safe Pin projections for enum variants while maintaining proper drop semantics and Unpin trait bounds.