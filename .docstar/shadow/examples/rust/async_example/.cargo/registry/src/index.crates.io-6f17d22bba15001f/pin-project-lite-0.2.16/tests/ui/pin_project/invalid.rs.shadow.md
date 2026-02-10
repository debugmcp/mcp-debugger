# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/pin-project-lite-0.2.16/tests/ui/pin_project/invalid.rs
@source-hash: 1c84cc089623dd31
@generated: 2026-02-09T18:02:35Z

**Purpose**: Test file containing invalid usage patterns of `pin_project_lite::pin_project` macro to verify proper error handling and diagnostic messages.

**Key Test Cases**:
- **Struct A (L6-9)**: Tests invalid `#[pin()]` syntax with empty parentheses - expects "no rules expected the token `(`" error
- **Struct B (L14-16)**: Tests misplaced `#[pin]` attribute on struct instead of field - expects "cannot find attribute `pin` in this scope" error  
- **Struct C (L20-24)**: Tests duplicate `#[pin]` attributes on same field - expects "no rules expected the token `#`" error

**Dependencies**:
- `pin_project_lite::pin_project` (L3) - The macro being tested for error conditions

**Architecture**: 
- Negative test file using compile-fail pattern with `//~` error annotations
- Each test case demonstrates a different invalid usage scenario
- Empty `main()` function (L27) required for compilation context

**Testing Pattern**: Uses Rust's compile-fail testing mechanism where `//~` comments indicate expected compiler errors. This ensures the macro properly rejects malformed syntax and provides meaningful diagnostics.