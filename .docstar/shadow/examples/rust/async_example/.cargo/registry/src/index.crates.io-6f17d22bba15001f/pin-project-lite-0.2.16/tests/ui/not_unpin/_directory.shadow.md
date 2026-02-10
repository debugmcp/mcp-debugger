# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/pin-project-lite-0.2.16/tests/ui/not_unpin/
@generated: 2026-02-09T18:16:02Z

## Purpose

This directory contains UI tests for the `pin-project-lite` crate that validate proper handling of `Unpin` trait implementations when using the `#[project(!Unpin)]` annotation. The tests ensure the macro correctly rejects conflicting implementations while allowing legitimate manual `Unpin` implementations.

## Key Components

### Test Categories

**Conflict Detection Tests (`conflict-unpin.rs`)**
- Tests scenarios where manual `Unpin` implementations should be rejected
- Three struct variants (`Foo`, `Bar`, `Baz`) with identical pin projection configurations
- Each paired with different manual `Unpin` implementations (conditional, unconditional, multi-bound)
- Validates that `#[project(!Unpin)]` prevents automatic `Unpin` derivation conflicts

**Negative Implementation Tests (`negative_impls_stable.rs`)**
- Validates legitimate manual `Unpin` implementations are allowed despite `#[project(!Unpin)]`
- Uses impossible trait bounds (`for<'cursed> str: Sized`) to create effectively non-`Unpin` types
- Regression test for issue #340 ensuring macro compatibility with explicit `Unpin` bounds

### Test Architecture

All tests follow the pin-project-lite pattern:
- Generic structs with `#[pin]` and regular fields
- `#[project(!Unpin)]` annotation to disable automatic `Unpin` derivation  
- Manual `Unpin` implementations with varying constraint scenarios
- Compile-time validation through trait bound requirements

## Testing Strategy

**Error Cases**: `conflict-unpin.rs` tests should fail compilation, demonstrating the macro properly detects and rejects conflicting `Unpin` implementations that could lead to unsound pin projections.

**Success Cases**: `negative_impls_stable.rs` should compile successfully, proving that legitimate manual `Unpin` implementations work correctly with the `!Unpin` annotation.

## Dependencies

- `pin_project_lite::pin_project` macro for generating pin projection code
- `core::marker::PhantomPinned` for creating non-`Unpin` marker types
- Rust's trait system for `Unpin` bound validation

## Role in Larger System

This test suite ensures the safety and correctness of pin projections in the `pin-project-lite` crate by validating that the `!Unpin` annotation works as intended - preventing unsound automatic implementations while still allowing sound manual ones. These UI tests are critical for maintaining memory safety guarantees in async Rust code that relies on pinned projections.