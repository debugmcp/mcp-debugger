# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/quote-1.0.42/tests/ui/
@generated: 2026-02-09T18:16:08Z

## Overall Purpose
This directory contains UI (User Interface) tests for the `quote` crate's procedural macro functionality. These are negative test cases designed to **fail compilation** and verify that the quote macros produce appropriate error messages when used incorrectly. The tests serve as a safety net to ensure the quote system's compile-time validation works properly.

## Key Components and Organization
The test suite is organized around different categories of invalid quote macro usage:

### Repetition Pattern Errors
- **`does-not-have-iter.rs`**: Tests repetition syntax `#(a b)*` without any iterable expression
- **`does-not-have-iter-interpolated.rs`**: Tests `#(#nonrep)*` where the interpolated value is not an iterator
- **`does-not-have-iter-interpolated-dup.rs`**: Tests `#(#nonrep #nonrep)*` with duplicate non-iterator references
- **`does-not-have-iter-separated.rs`**: Tests `#(a b),*` where repetition elements lack proper separators

### Type Safety Errors
- **`not-quotable.rs`**: Tests interpolation of types that don't implement `ToTokens` trait (uses `Ipv4Addr`)
- **`not-repeatable.rs`**: Tests repetition patterns with non-repeatable types
- **`wrong-type-span.rs`**: Tests `quote_spanned!` macro with incorrect span type (string instead of proper span)

## Test Architecture Pattern
All files follow a consistent UI test pattern:
1. Import the relevant quote macros (`quote!`, `quote_spanned!`)
2. Create a minimal `main()` function containing the problematic code
3. Use deliberately incorrect syntax or types that should trigger compilation errors
4. Rely on the test harness to verify expected error messages are produced

## Critical Safety Mechanisms Tested
- **Infinite loop prevention**: Multiple tests ensure repetition patterns can't cause infinite expansion
- **Type safety**: Verification that only compatible types can be used with quote macros
- **Syntax validation**: Ensures proper separator and iterator requirements in repetition patterns
- **Span type checking**: Validates that span parameters are properly typed

## Dependencies
All tests depend on the `quote` crate's core macros:
- `quote!` - Primary code generation macro
- `quote_spanned!` - Span-aware code generation macro

## Public API Validation
These tests validate the compile-time behavior of the quote crate's main public API surface, ensuring that error conditions are properly caught and reported during macro expansion rather than causing runtime issues or infinite compilation loops.