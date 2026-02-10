# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/pin-project-lite-0.2.16/tests/expand/multifields/struct.expanded.rs
@source-hash: 7257c732191d5dd6
@generated: 2026-02-09T18:03:22Z

## Purpose
This is macro-expanded code demonstrating pin-project-lite's code generation for a struct with multiple pinned and unpinned fields. It serves as a test case showing how the `pin_project` macro transforms a simple struct into a comprehensive Pin-safe projection system.

## Key Structures

### Original Struct (L2-7)
- `Struct<T, U>`: Generic struct with 4 fields - two pinned (`T`) and two unpinned (`U`)
- Fields: `pinned1`, `pinned2` (type T), `unpinned1`, `unpinned2` (type U)

### Generated Helper Structs
- `StructProjReplace<T, U>` (L20-25): Replacement projection using `PhantomData` for pinned fields
- `Projection<'__pin, T, U>` (L50-58): Mutable projection with `Pin<&mut T>` for pinned fields, `&mut U` for unpinned
- `ProjectionRef<'__pin, T, U>` (L72-80): Immutable projection with `Pin<&T>` for pinned fields, `&U` for unpinned
- `__Origin<'__pin, T, U>` (L149-155): Internal helper for Unpin analysis using `AlwaysUnpin<U>` wrappers

## Core Implementation (L81-147)

### Projection Methods
- `project()` (L84-97): Creates mutable projections using unsafe `get_unchecked_mut()` and `Pin::new_unchecked()`
- `project_ref()` (L100-112): Creates immutable projections using unsafe `get_ref()` and `Pin::new_unchecked()`
- `project_replace()` (L115-146): Complex replacement operation using `UnsafeOverwriteGuard` and `UnsafeDropInPlaceGuard`

## Safety Mechanisms

### Unpin Implementation (L156-161)
Conditional Unpin based on `PinnedFieldsOf<__Origin>` being Unpin - ensures struct is only Unpin when safe

### Drop Safety (L162-165)
- `MustNotImplDrop` trait prevents manual Drop implementation on pin-projected structs
- Blanket impl prevents `Drop` trait conflicts

### Memory Layout Validation (L167-172)
- `__assert_not_repr_packed()`: Compile-time check preventing `#[repr(packed)]` usage
- Uses `#[forbid(unaligned_references)]` to catch unsafe packed struct references

## Dependencies
- `pin_project_lite::__private`: Internal utilities for Pin, PhantomData, guards, and ptr operations
- Standard library: Pin, PhantomData, ptr operations

## Architectural Pattern
Follows pin-project-lite's zero-cost projection pattern:
1. Generate typed projection structs for each access pattern
2. Provide unsafe but encapsulated projection methods
3. Enforce Pin safety through compile-time checks and guards
4. Use PhantomData for replaced pinned fields to maintain type safety