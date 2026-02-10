# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/pin-project-lite-0.2.16/tests/expand/multifields/struct.rs
@source-hash: 1fe2b911e8782eaa
@generated: 2026-02-09T18:03:11Z

## Purpose
Test file demonstrating `pin_project_lite` macro usage with multiple pinned and unpinned fields in a generic struct. Part of the pin-project-lite crate's test suite for expansion verification.

## Key Components
- **Struct<T, U>** (L7-14): Generic struct with mixed field pinning
  - `pinned1: T` (L9): First pinned field of type T
  - `pinned2: T` (L11): Second pinned field of type T  
  - `unpinned1: U` (L12): First unpinned field of type U
  - `unpinned2: U` (L13): Second unpinned field of type U
- **main()** (L17): Empty entry point for compilation testing

## Dependencies
- `pin_project_lite::pin_project` (L3): Core macro for generating pin projection code

## Architectural Pattern
Uses `pin_project!` macro (L5-15) with `#[project_replace = StructProjReplace]` attribute (L6) to generate:
- Projection types for safe pin manipulation
- Replace functionality via StructProjReplace type
- Selective pinning using `#[pin]` attributes on specific fields

## Key Characteristics
- Demonstrates multi-field pinning scenarios with 2 pinned + 2 unpinned fields
- Tests generic type parameters (T, U) in pinned context
- Validates macro expansion for complex struct layouts
- Part of automated testing infrastructure for pin-project-lite correctness