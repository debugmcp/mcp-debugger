# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/syn-2.0.110/tests/test_lit.rs
@source-hash: 4130efa425d14ed3
@generated: 2026-02-09T18:12:05Z

## Primary Purpose
Test file for syn's literal parsing functionality, verifying correct parsing and round-trip serialization of Rust literal tokens including strings, byte strings, C strings, characters, bytes, integers, and floats.

## Key Test Infrastructure
- `lit(s: &str) -> Lit` (L22-32): Core utility that parses a string into a `TokenStream`, extracts the first literal token, and converts it to a `syn::Lit`. Uses `#[track_caller]` for better error reporting.
- Module imports (L11-14): Uses local `snapshot` macro module and `debug` module for test infrastructure.

## Test Functions
- `strings()` (L34-73): Tests string literal parsing with nested `test_string` helper (L36-49). Covers empty strings, escape sequences, Unicode, raw strings, and suffix handling.
- `byte_strings()` (L75-107): Tests byte string literals with `test_byte_string` helper (L77-90). Covers raw byte strings and escape sequences.
- `c_strings()` (L109-146): Tests C string literals with `test_c_string` helper (L111-124). Tests escaping, Unicode, and raw C strings.
- `bytes()` (L148-170): Tests single byte literals with `test_byte` helper (L150-161). 
- `chars()` (L172-198): Tests character literals with `test_char` helper (L174-187). Includes Unicode and emoji support.
- `ints()` (L200-239): Tests integer parsing with `test_int` helper (L202-215). Covers decimal, hex, binary, octal, suffixes, and underscores.
- `floats()` (L241-266): Tests floating-point parsing with `test_float` helper (L243-256). Covers scientific notation and suffixes.
- `negative()` (L268-279): Tests negative literal construction using `LitInt::new` and `LitFloat::new`.
- `suffix()` (L281-313): Tests suffix extraction with `get_suffix` helper (L283-296) for all literal types.
- `test_deep_group_empty()` (L315-326): Tests parsing literals from deeply nested token groups.
- `test_error()` (L328-335): Tests error handling for invalid literal parsing.

## Test Patterns
- All test helpers use `#[track_caller]` for precise error location reporting
- Round-trip testing: parses literal, converts back to tokens, and re-tests if representation differs
- Comprehensive coverage of Rust literal syntax including edge cases and Unicode support
- Suffix validation for typed literals (e.g., `u32`, `f64`, `i8`)

## Dependencies
- `proc_macro2`: TokenStream manipulation and literal tokens
- `quote`: Token stream conversion via `ToTokens`
- `syn`: Literal parsing and AST types (`Lit`, `LitFloat`, `LitInt`, `LitStr`)
- `std::ffi::CStr`: C string comparison