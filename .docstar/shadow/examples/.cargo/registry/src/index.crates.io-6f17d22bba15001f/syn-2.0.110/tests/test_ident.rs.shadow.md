# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/syn-2.0.110/tests/test_ident.rs
@source-hash: d5850e817720e774
@generated: 2026-02-09T18:12:04Z

**Purpose**: Test module for Rust identifier (`Ident`) parsing and creation functionality in the `syn` crate, validating both successful parsing and proper error handling for invalid inputs.

**Key Functions**:
- `parse(s: &str)` (L6-8): Helper function that converts a string to `TokenStream` and attempts to parse it as an `Ident` using `syn::parse2`. Uses `#[track_caller]` for better error tracing.
- `new(s: &str)` (L11-13): Helper function that creates an `Ident` directly using `Ident::new` with `Span::call_site()`. Uses `#[track_caller]` for better panic tracing.

**Test Categories**:

*Parsing Tests (L15-48)*: Validate `syn::parse2` behavior
- `ident_parse` (L16-18): Tests successful parsing of valid identifier "String"
- `ident_parse_keyword` (L21-23): Verifies keywords like "abstract" fail to parse
- `ident_parse_empty` (L26-28): Confirms empty strings are rejected
- `ident_parse_lifetime` (L31-33): Ensures lifetime syntax "'static" is rejected
- `ident_parse_underscore` (L36-38): Validates underscore "_" is rejected in parsing
- `ident_parse_number` (L41-43): Confirms numeric strings "255" fail to parse
- `ident_parse_invalid` (L46-48): Tests rejection of invalid characters "a#"

*Creation Tests (L50-87)*: Validate `Ident::new` behavior
- `ident_new` (L51-53): Tests successful creation of valid identifier "String"
- `ident_new_keyword` (L56-58): Verifies keywords can be created (different from parsing)
- `ident_new_empty` (L62-64): Uses `#[should_panic]` to test empty string rejection with specific error message
- `ident_new_lifetime` (L68-70): Tests panic on lifetime syntax with validation message
- `ident_new_underscore` (L73-75): Confirms underscore is valid for creation (unlike parsing)
- `ident_new_number` (L79-81): Tests panic on numeric input with "use Literal instead" message
- `ident_new_invalid` (L85-87): Tests panic on invalid characters with specific error format

**Dependencies**:
- `proc_macro2`: Provides `Ident`, `Span`, and `TokenStream` types
- `syn`: Provides parsing functionality via `parse2` and `Result` type
- `std::str::FromStr`: Used for string-to-TokenStream conversion

**Key Insights**:
- Demonstrates different validation behavior between parsing (`syn::parse2`) and direct creation (`Ident::new`)
- Parsing is more restrictive (rejects keywords, underscore) while creation allows some edge cases
- Uses `#[track_caller]` for better debugging in helper functions
- Comprehensive coverage of edge cases and error conditions with specific panic message validation