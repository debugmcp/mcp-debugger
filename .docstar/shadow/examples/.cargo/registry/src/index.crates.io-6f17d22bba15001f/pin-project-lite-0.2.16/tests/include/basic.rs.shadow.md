# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/pin-project-lite-0.2.16/tests/include/basic.rs
@source-hash: 8c06c765c92d6962
@generated: 2026-02-09T18:06:26Z

## Purpose
Test file demonstrating basic usage patterns of `pin_project_lite::pin_project!` macro across different type definitions (structs and enums) with various configuration options.

## Key Types and Structures

### DefaultStruct<T, U> (L5-14)
- Basic generic struct with mixed pinned/unpinned fields
- Field `pinned: T` marked with `#[pin]` attribute (L10-11)
- Field `unpinned: U` remains unpinned (L12)
- Uses default projection naming

### DefaultStructNamed<T, U> (L16-27)
- Similar to DefaultStruct but with explicit projection names
- Custom projection types: `DefaultStructProj` and `DefaultStructProjRef` (L19-20)
- Same field layout: pinned T, unpinned U (L23-25)

### DefaultEnum<T, U> (L29-45)
- Generic enum demonstrating pin projection on enum variants
- `Struct` variant with mixed pinned/unpinned fields (L37-41)
- `Unit` variant with no fields (L43)
- Custom projection names: `DefaultEnumProj` and `DefaultEnumProjRef` (L32-33)

### PinnedDropStruct<T, U> (L47-59)
- Struct with custom drop implementation via `PinnedDrop` trait
- Same field layout as basic structs (L52-54)
- Empty `PinnedDrop::drop` implementation (L56-58)

### PinnedDropEnum<T: Unpin, U> (L61-81)
- Enum with `PinnedDrop` implementation and `Unpin` bound on T
- Type constraint: `T: ::pin_project_lite::__private::Unpin` (L67)
- Same variant structure as DefaultEnum (L69-76)
- Empty `PinnedDrop::drop` implementation (L78-80)

## Dependencies
- `pin_project_lite` crate for the `pin_project!` macro
- Uses `pin_project_lite::__private::Unpin` trait bound (L67, L78)

## Patterns and Architecture
- Demonstrates progressive complexity: basic → named projections → enums → pinned drop
- Consistent use of generic parameters `<T, U>` across all types
- Standard pattern: T is pinned field type, U is unpinned field type
- All types derive `Debug` and include clippy allow attributes for exhaustive types
- PinnedDrop implementations are minimal/empty (testing compilation rather than behavior)

## Testing Context
This is a test file validating that `pin_project_lite` macro correctly generates projection code for various type definitions and configurations.