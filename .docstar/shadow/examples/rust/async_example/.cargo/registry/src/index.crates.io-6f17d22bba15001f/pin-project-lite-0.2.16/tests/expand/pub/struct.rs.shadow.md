# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/pin-project-lite-0.2.16/tests/expand/pub/struct.rs
@source-hash: 05cb3f03ef9801fe
@generated: 2026-02-09T18:02:36Z

## Purpose
Test file for pin-project-lite macro expansion demonstrating public struct generation with mixed pinned/unpinned fields.

## Key Components
- **Struct<T, U>** (L6-10): Public generic struct demonstrating pin-project-lite macro usage
  - `pinned: T` field (L8): Marked with `#[pin]` attribute, will be projection-pinned
  - `unpinned: U` field (L9): Regular field, remains unpinned in projections
- **main()** (L13): Empty entry point required for test compilation

## Dependencies
- **pin_project_lite** (L3): Provides the `pin_project!` macro for safe pin projection generation

## Architectural Patterns
- Uses declarative macro `pin_project!` to generate Pin projection implementations
- Mixed field pinning pattern: selective pinning of struct fields based on `#[pin]` attribute
- Public API exposure: all generated types and fields maintain public visibility

## Generated Behavior (Implicit)
The macro generates:
- Pin projection struct with same generic parameters
- Safe projection methods for accessing pinned/unpinned fields
- Appropriate `Unpin` trait bounds based on pinned field types

## Test Context
Part of expansion test suite verifying macro-generated code for public structs with generic type parameters.