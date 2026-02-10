# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/syn-2.0.110/tests/common/parse.rs
@source-hash: f226bfa84803429c
@generated: 2026-02-09T18:06:28Z

## Purpose and Responsibility

Test utility module providing parsing functions to compare syn and rustc AST expression parsing capabilities. Used for validating syn's parser behavior against the official Rust compiler parser.

## Key Functions

### `librustc_expr` (L14-42)
- **Purpose**: Parse Rust expressions using the official rustc compiler parser
- **Parameters**: `input: &str` - source code string to parse
- **Returns**: `Option<Box<ast::Expr>>` - parsed expression or None on failure
- **Implementation**: 
  - Creates a ParseSess with default locale resources (L16-17)
  - Uses custom filename "test_precedence" for error reporting (L18)
  - Wraps parsing in panic::catch_unwind for crash protection (L15)
  - Strips shebang and frontmatter tokens during parsing (L23)
  - Emits diagnostics on parse errors (L30)

### `syn_expr` (L44-52)
- **Purpose**: Parse Rust expressions using the syn crate parser
- **Parameters**: `input: &str` - source code string to parse  
- **Returns**: `Option<syn::Expr>` - parsed expression or None on failure
- **Implementation**: Direct call to `syn::parse_str` with error handling

## Dependencies

- **rustc internals**: `rustc_ast`, `rustc_driver`, `rustc_parse`, `rustc_session`, `rustc_span` (L1-6, L8-11)
- **syn crate**: Implicitly used in `syn_expr` function
- **std::panic**: For crash recovery in rustc parsing (L12)

## Architectural Patterns

- **Dual parser comparison**: Provides equivalent functionality for both parsers
- **Graceful error handling**: Both functions return Options instead of panicking
- **Panic isolation**: rustc parsing wrapped in catch_unwind to prevent test crashes
- **Error reporting**: Uses `errorf!` macro for consistent error output (L38, L48)

## Critical Notes

- The `errorf!` macro is not defined in this file - must be provided by test framework
- rustc parser setup is more complex, requiring session management and locale resources
- Both functions are designed for test environments, not production parsing