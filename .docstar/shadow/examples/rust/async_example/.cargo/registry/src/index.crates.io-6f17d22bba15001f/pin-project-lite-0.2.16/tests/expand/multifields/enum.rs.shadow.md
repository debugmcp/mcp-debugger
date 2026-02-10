# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/pin-project-lite-0.2.16/tests/expand/multifields/enum.rs
@source-hash: d38eb301c86307ed
@generated: 2026-02-09T18:02:27Z

## Purpose
Test case for `pin_project_lite` macro expansion with multi-field enum variants. Demonstrates how the macro handles enums with both pinned and unpinned fields in struct variants.

## Key Elements
- **Enum Definition (L7-17)**: Generic enum `Enum<T, U>` with two variants:
  - `Struct` variant (L8-15): Contains mixed pinned (`T` type) and unpinned (`U` type) fields
  - `Unit` variant (L16): Empty variant for completeness
- **Pin Annotations (L9, L11)**: `#[pin]` attributes on `pinned1` and `pinned2` fields
- **Project Replace Attribute (L6)**: Specifies `EnumProjReplace` as the replacement projection type
- **Entry Point (L20)**: Empty `main()` function - this is a test file

## Dependencies
- `pin_project_lite` crate (L3): Core macro for generating pin projections

## Architectural Patterns
- **Macro Testing**: Part of pin-project-lite's test suite for verifying macro expansion correctness
- **Mixed Field Types**: Tests handling of both pinned (`T`) and unpinned (`U`) fields within the same variant
- **Generic Enum Support**: Validates macro works with generic type parameters

## Critical Invariants
- Fields marked with `#[pin]` (`pinned1`, `pinned2`) will be projected as pinned references
- Unpinned fields (`unpinned1`, `unpinned2`) will be projected as regular references
- The macro generates appropriate projection types for enum pattern matching