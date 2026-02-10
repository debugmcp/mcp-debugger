# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/pin-project-lite-0.2.16/tests/expand/default/struct.rs
@source-hash: 05767cd68ec5cddc
@generated: 2026-02-09T18:02:29Z

This file demonstrates a basic usage example of the `pin-project-lite` crate's macro system for creating self-referential structs with pinning support.

## Primary Purpose
Test file showcasing the fundamental `pin_project!` macro usage pattern for creating structs with mixed pinned and unpinned fields.

## Key Components

**Struct Definition (L5-11)**: The `pin_project!` macro generates a generic struct `Struct<T, U>` with:
- `pinned: T` field marked with `#[pin]` attribute (L7-8) - will be projection-pinned when the struct is pinned
- `unpinned: U` field (L9) - remains movable even when struct is pinned

**Main Function (L13)**: Empty entry point, indicating this is primarily a compilation/expansion test.

## Dependencies
- `pin_project_lite::pin_project` macro (L3) - core macro for generating pinning projection code

## Architectural Pattern
Follows the pin-projection pattern where:
1. Macro generates projection types and implementations
2. Pinned fields maintain their pinning guarantees through projections
3. Unpinned fields can be moved freely regardless of struct's pin state

## Generated Code Implications
The macro will generate:
- Projection structs for mutable/immutable field access
- `Pin` trait implementations
- Helper methods for safe field access under pinning

This is a minimal example demonstrating the dual-field pinning scenario commonly used in async Rust code.