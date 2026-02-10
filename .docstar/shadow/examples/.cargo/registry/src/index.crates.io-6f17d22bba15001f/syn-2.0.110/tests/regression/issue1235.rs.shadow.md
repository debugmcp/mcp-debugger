# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/syn-2.0.110/tests/regression/issue1235.rs
@source-hash: a2266b10c3f7c7af
@generated: 2026-02-09T18:06:27Z

## Primary Purpose
Regression test for syn parser issue #1235 that previously caused parser crashes when handling malformed static declarations within grouped tokens.

## Key Functions and Test Cases

**main() test function (L5-32)**: Tests three parsing scenarios for static declarations:

1. **Basic malformed statics (L8-13)**: Tests parsing of top-level static declarations without values (`pub static FOO: usize;`). These are syntactically valid but semantically invalid in Rust - syn correctly parses them as `Item::Verbatim`.

2. **Grouped valid statics (L16-22)**: Tests parsing of properly formed static declarations wrapped in a delimiter-less group (`static FOO: usize = 0; pub static BAR: usize = 0`). This represents valid Rust syntax that should parse successfully.

3. **Grouped malformed statics (L25-31)**: Tests the regression case - malformed static declarations (without values) wrapped in a delimiter-less group. This combination previously caused parser crashes but should now parse as `Item::Verbatim`.

## Dependencies
- `proc_macro2::Group` and `Delimiter`: For creating token groups without delimiters
- `quote::quote`: For generating token streams from Rust syntax
- `syn`: Parser being tested for handling these edge cases

## Architecture Pattern
Classic regression test structure using `quote!` macro to generate problematic token streams, then verifying syn can parse them without crashing. Each test case builds increasingly complex scenarios that exercise different parser paths.

## Critical Behavior
The test validates that syn gracefully handles syntactically valid but semantically questionable code patterns, particularly when they appear in unusual token group configurations. The parser should never crash, instead falling back to `Item::Verbatim` for unparseable constructs.