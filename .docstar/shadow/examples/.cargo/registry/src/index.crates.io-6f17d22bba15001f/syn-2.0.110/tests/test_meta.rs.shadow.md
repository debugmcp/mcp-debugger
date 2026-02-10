# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/syn-2.0.110/tests/test_meta.rs
@source-hash: 5b0fdee0decbd074
@generated: 2026-02-09T18:12:01Z

## Purpose
Test suite for `syn`'s meta-attribute parsing functionality, validating the parsing of Rust attribute metadata in various forms (path, name-value, list) using snapshot testing.

## Key Test Functions
- `test_parse_meta_item_word` (L18-31): Tests parsing simple identifier meta items like `hello` into `Meta::Path`
- `test_parse_meta_name_value` (L33-69): Tests parsing name-value pairs like `foo = 5` into both `MetaNameValue` and `Meta::NameValue` variants
- `test_parse_meta_item_list_lit` (L71-105): Tests parsing meta lists with literals like `foo(5)` into `MetaList` and `Meta::List` variants
- `test_parse_meta_item_multiple` (L107-141): Tests parsing complex nested meta lists with multiple elements `foo(word, name = 5, list(name2 = 6), word2)`
- `test_parse_path` (L143-160): Tests parsing qualified paths like `::serde::Serialize` with leading colons
- `test_fat_arrow_after_meta` (L162-180): Tests parsing meta items followed by fat arrow syntax in cfg-like contexts

## Dependencies
- `quote` crate for generating token streams (L14)
- `syn` parsing infrastructure: `ParseStream`, `Parser`, `Result` (L15)
- `syn` meta types: `Meta`, `MetaList`, `MetaNameValue`, `Token` (L16)
- Local `snapshot` module for test assertions (L10)
- Local `debug` module (L12)

## Testing Patterns
- Uses `snapshot!` macro for expected output verification with multi-line string literals
- Tests both specific type parsing (e.g., `MetaNameValue`) and generic `Meta` enum parsing
- Validates structural equality between parsed variants using `assert_eq!`
- Employs custom parser functions with `ParseStream` for complex parsing scenarios

## Architecture Notes
- Follows standard Rust test module structure with `#[test]` attributes
- Leverages syn's visitor pattern and AST representation for meta attribute parsing
- Uses procedural macro token stream manipulation for test input generation