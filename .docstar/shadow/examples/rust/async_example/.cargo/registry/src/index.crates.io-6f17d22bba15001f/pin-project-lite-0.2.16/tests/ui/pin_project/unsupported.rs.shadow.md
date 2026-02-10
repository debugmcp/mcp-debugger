# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/pin-project-lite-0.2.16/tests/ui/pin_project/unsupported.rs
@source-hash: 3ad5f584f9e56be3
@generated: 2026-02-09T18:02:39Z

## Purpose
Negative test file that validates `pin_project!` macro error handling for unsupported struct and type definitions.

## Structure
- **Test cases (L5-27)**: Collection of `pin_project!` invocations designed to trigger specific compile errors
- **Main function (L29)**: Empty entry point required for test compilation

## Key Test Cases
- **Struct1 (L5-7)**: Tests unit struct with braces `{}` - expects "no rules expected the token `}`" error
- **Struct2 (L9-11)**: Tests tuple struct syntax `()` - expects "no rules expected the token `(`" error  
- **Struct3 (L13-15)**: Tests unit struct declaration `;` - expects "no rules expected the token `;`" error
- **Enum (L17-21)**: Tests enum definition - expects "no rules expected the token `enum`" error
- **Union (L23-27)**: Tests union definition - expects "no rules expected the token `union`" error

## Dependencies
- `pin_project_lite::pin_project`: The macro being tested for error conditions

## Testing Pattern
Each test case uses the pattern:
```rust
pin_project! {
    <unsupported_syntax> //~ ERROR <expected_error_message>
}
```

The `//~` comments specify expected compiler error messages for UI test validation.

## Architectural Context
Part of `pin-project-lite` crate's UI test suite that ensures the macro properly rejects unsupported syntax with clear error messages. This helps maintain API boundaries and provides good developer experience.