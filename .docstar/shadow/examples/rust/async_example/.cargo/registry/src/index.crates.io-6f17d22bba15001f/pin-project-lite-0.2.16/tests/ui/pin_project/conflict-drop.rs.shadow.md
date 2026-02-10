# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/pin-project-lite-0.2.16/tests/ui/pin_project/conflict-drop.rs
@source-hash: a1964fa136080cc3
@generated: 2026-02-09T18:02:35Z

## Primary Purpose
UI test file demonstrating a compilation error when using `pin_project!` macro on a struct that already has a manual `Drop` implementation. This creates a trait implementation conflict (E0119).

## Key Components
- **Foo struct (L5-11)**: Generic struct with pinned `future` field and regular `field`, wrapped in `pin_project!` macro
- **Drop implementation (L13-15)**: Manual `Drop` trait implementation for `Foo<T, U>`
- **main function (L17)**: Empty entry point

## Dependencies
- `pin_project_lite::pin_project` (L3): Macro for generating safe pin projection implementations

## Architecture & Pattern
This is a **negative test case** that demonstrates the conflict between:
1. The `pin_project!` macro which automatically generates `Drop` implementations for safe pin handling
2. Manual `Drop` trait implementations by the user

The expected compilation error (E0119) occurs because Rust prevents conflicting trait implementations for the same type.

## Critical Constraints
- The `#[pin]` attribute on `future` field (L7) requires the macro to generate special drop handling
- Manual `Drop` implementation (L13-15) conflicts with macro-generated drop code
- This pattern is intentionally forbidden to prevent memory safety issues in pin projection