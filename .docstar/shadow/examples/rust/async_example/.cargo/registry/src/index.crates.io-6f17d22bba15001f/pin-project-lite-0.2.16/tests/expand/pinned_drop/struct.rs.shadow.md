# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/pin-project-lite-0.2.16/tests/expand/pinned_drop/struct.rs
@source-hash: 8da271d7d3182b33
@generated: 2026-02-09T18:02:35Z

## Primary Purpose
Test file demonstrating the `pin_project!` macro with custom `PinnedDrop` implementation. Part of the pin-project-lite crate's test suite for verifying macro expansion behavior when combining pinned projections with custom drop logic.

## Key Components

### Struct Declaration (L5-16)
- `Struct<T, U>` (L6): Generic struct with mixed pinning requirements
- `pinned: T` field (L7-8): Field marked with `#[pin]` attribute, will be pinned in projections
- `unpinned: U` field (L9): Regular field that remains movable

### Custom Drop Implementation (L11-15)
- `PinnedDrop` trait implementation (L11): Custom drop logic that receives `Pin<&mut Self>`
- `drop` method (L12-14): Minimal implementation that accepts pinned self reference but performs no operations
- Line 13: No-op statement consuming the pinned reference

### Entry Point (L18)
- `main()` function: Empty entry point for compilation testing

## Dependencies
- `pin_project_lite::pin_project` (L3): Macro for generating safe pinned projections

## Architectural Pattern
Demonstrates the pin-project-lite pattern for:
1. Safe field projection in pinned contexts
2. Custom drop logic that respects Pin guarantees
3. Mixed pinned/unpinned field handling

## Critical Constraints
- The `PinnedDrop::drop` method receives `Pin<&mut Self>` ensuring drop safety
- Pinned fields cannot be moved during drop
- The macro generates appropriate projection methods while preserving Pin invariants