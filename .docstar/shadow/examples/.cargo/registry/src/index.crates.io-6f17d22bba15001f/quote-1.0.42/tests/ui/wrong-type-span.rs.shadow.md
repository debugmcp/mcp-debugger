# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/quote-1.0.42/tests/ui/wrong-type-span.rs
@source-hash: 6195e35ea844c0c5
@generated: 2026-02-09T18:06:22Z

**Purpose**: Test file demonstrating incorrect usage of the `quote_spanned!` macro with an invalid span type.

**Primary Function**: 
- `main()` (L3-7): Creates a test case that should fail compilation due to type mismatch

**Test Scenario**:
The test intentionally uses a string literal `""` as the span parameter (L4) for `quote_spanned!` macro (L6), which expects a proper span type (typically from `proc_macro2::Span` or similar). This is designed to trigger a compiler error demonstrating the macro's type safety.

**Key Elements**:
- `span` variable (L4): Incorrectly typed as string literal instead of proper span
- `x` variable (L5): Simple integer used in the quote expression
- `quote_spanned!` invocation (L6): Uses invalid span type with token interpolation `#x`

**Dependencies**: 
- `quote::quote_spanned` macro (L1)

**Expected Behavior**: This test should fail to compile, serving as a negative test case for the quote crate's UI testing suite to verify proper error messages are generated when span types are incorrect.