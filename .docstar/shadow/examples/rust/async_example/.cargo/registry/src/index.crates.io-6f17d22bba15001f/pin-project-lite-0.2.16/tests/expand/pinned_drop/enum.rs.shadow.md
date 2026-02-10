# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/pin-project-lite-0.2.16/tests/expand/pinned_drop/enum.rs
@source-hash: 8f590791cb4693bb
@generated: 2026-02-09T18:02:35Z

## Purpose
Test file demonstrating pin-project-lite's code generation for enums with pinned drop handlers. Validates macro expansion for projection types and custom drop implementation.

## Key Components

### Enum Definition (L5-21)
- `Enum<T, U>` - Generic enum with two variants using `pin_project!` macro
- `Struct` variant (L9-13) - Contains pinned field `T` and unpinned field `U`
- `Unit` variant (L14) - Empty variant for testing projection completeness
- Projection attributes generate `EnumProj` and `EnumProjRef` types (L6-7)

### PinnedDrop Implementation (L16-20)
- Custom drop handler for pinned data using `Pin<&mut Self>`
- Minimal implementation that consumes the pinned reference (L18)
- Ensures proper cleanup semantics for pinned memory

### Dependencies
- `pin_project_lite` crate for macro-based pin projection
- Standard library `Pin` type for memory pinning guarantees

## Architecture Notes
- Uses macro-based approach for generating projection boilerplate
- Demonstrates safe pinning patterns for enum variants with mixed pinned/unpinned fields
- Test structure validates macro expansion correctness without runtime behavior

## Entry Point
- `main()` function (L23) - Empty test harness, compilation validates macro expansion