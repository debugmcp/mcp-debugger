# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/quote-1.0.42/src/format.rs
@source-hash: 141ee1049cfbe363
@generated: 2026-02-09T18:11:47Z

## format.rs - Identifier Formatting Macros

**Primary Purpose**: Provides `format_ident!` macro for constructing proc-macro2 `Ident`s with format-string syntax, similar to `format!` but specialized for identifier generation.

### Key Macros

**`format_ident!` (L111-125)**
- Public macro providing `format!`-like syntax for creating identifiers
- Supports both simple format strings and arguments with positional/named parameters
- Delegates to internal `format_ident_impl!` macro with span handling

**`format_ident_impl!` (L129-168)**
- Hidden implementation macro handling the format string parsing and argument processing
- Uses recursive macro patterns to process arguments sequentially
- Key pattern matching arms:
  - Final state (L131-136): Creates identifier via `mk_ident` with formatted string
  - Span override (L139-147): Handles explicit `span = expr` arguments
  - Named arguments (L150-157): Processes `name = value` patterns
  - Positional arguments (L160-167): Processes direct value arguments

### Architecture & Patterns

**Span Inheritance System**
- Uses first `Ident` argument's span for the result identifier (L39-41)
- Falls back to `Span::call_site` when no identifiers provided
- Allows explicit span override via `span` named parameter (L51-61)

**IdentFragment Trait Integration**
- Uses custom `IdentFragment` trait instead of `Display` (L25-31)
- Wraps arguments in `IdentFragmentAdapter` to extract spans and format values
- Strips `r#` prefixes from raw identifiers automatically (L30)

**Recursive Macro Processing**
- Accumulates format string parts in `[$span, $($fmt)*]` state
- Processes arguments left-to-right, updating span as identifiers encountered
- Each argument pattern delegates to next recursive call with updated state

### Supported Format Types
- `{}` → `IdentFragment` (default)
- `{:o}` → `Octal`
- `{:x}` → `LowerHex` 
- `{:X}` → `UpperHex`
- `{:b}` → `Binary`

### Dependencies
- `proc_macro2::Ident` and `Span` types
- Internal `__private` module providing `mk_ident`, `format!`, and `IdentFragmentAdapter`
- `std::fmt` traits for numeric formatting

### Critical Constraints
- Result must be valid Rust identifier (panics otherwise - L70-71)
- Limited to supported format types only
- Span handling requires careful ordering of identifier arguments