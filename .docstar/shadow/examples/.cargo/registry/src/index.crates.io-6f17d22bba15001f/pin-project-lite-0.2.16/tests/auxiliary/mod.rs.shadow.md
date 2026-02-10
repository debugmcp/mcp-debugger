# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/pin-project-lite-0.2.16/tests/auxiliary/mod.rs
@source-hash: 52a78b77be05c677
@generated: 2026-02-09T18:06:19Z

**Purpose**: Test utility module providing macros to verify Unpin trait implementation status for pin-project-lite testing.

**Key Components**:
- `assert_unpin!` macro (L5-9): Validates that a type implements the Unpin trait using static_assertions
- `assert_not_unpin!` macro (L10-14): Validates that a type does NOT implement the Unpin trait using static_assertions

**Dependencies**:
- `static_assertions` crate for compile-time trait bound verification

**Usage Pattern**: 
These macros enable compile-time testing of whether pin-project-lite correctly applies or removes Unpin implementations based on field types. Essential for validating pin projection safety guarantees.

**Context**: Part of pin-project-lite's test infrastructure to ensure proper Unpin behavior - critical for memory safety in async/pinning scenarios where types must not be movable after pinning.