# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/pin-project-lite-0.2.16/tests/ui/pin_project/negative_impls_stable.rs
@source-hash: 1e70055fbec4bc0a
@generated: 2026-02-09T18:02:41Z

## Primary Purpose
Test case for pin-project-lite that verifies negative trait implementations work correctly in stable Rust, specifically testing edge cases around `Unpin` trait bounds with `PhantomPinned` types.

## Key Components

### Pin Project Structure (L5-11)
- **Foo<Pinned, Unpinned>**: Generic struct using `pin_project!` macro
  - `pinned` field (L8): Marked with `#[pin]` attribute, becomes structurally pinned
  - `unpinned` field (L9): Not pinned, can be moved freely

### Test Types (L13-15)
- **MyPhantomPinned (L13)**: Wrapper around `PhantomPinned` to prevent automatic `Unpin`
- **Unpin impl for MyPhantomPinned (L14)**: Uses impossible HRTB constraint `for<'cursed> str: Sized` - this bound can never be satisfied, making the impl effectively disabled
- **Unpin impl for Foo<MyPhantomPinned, ()> (L15)**: Manual `Unpin` implementation for specific type instantiation

### Test Infrastructure (L17-21)
- **is_unpin<T: Unpin>() (L17)**: Helper function requiring `T` to implement `Unpin`
- **main() (L19-21)**: Calls `is_unpin` with `Foo<MyPhantomPinned, ()>` - should compile successfully due to explicit `Unpin` impl

## Dependencies
- `pin_project_lite` crate for the `pin_project!` macro
- `core::marker::PhantomPinned` for pin-related type constraints

## Architectural Pattern
This follows a negative testing pattern where:
1. A type is made structurally non-`Unpin` through `PhantomPinned`
2. An impossible trait bound creates a "fake" `Unpin` impl that never applies
3. An explicit `Unpin` impl overrides the structural analysis
4. The test verifies the compiler correctly resolves trait bounds

## Critical Invariants
- The HRTB `for<'cursed> str: Sized` is intentionally unsatisfiable
- Without the explicit `Unpin` impl on L15, `Foo<MyPhantomPinned, ()>` would not be `Unpin`
- Tests compiler's ability to handle complex trait resolution with pin projections