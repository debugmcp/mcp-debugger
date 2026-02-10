# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/syn-2.0.110/src/lib.rs
@source-hash: 33992cd3fb39b1af
@generated: 2026-02-09T18:11:58Z

**Primary Purpose**: Root module for the Syn crate, a Rust parsing library for converting token streams into syntax trees. Primarily designed for procedural macros but offers general-purpose parsing capabilities for Rust source code.

## Core Architecture

The library is organized around feature-gated modules providing different levels of Rust syntax parsing:

### Key Parsing Functions
- `parse()` (L902-904) - Parses `proc_macro::TokenStream` into syntax tree nodes
- `parse2()` (L920-922) - Parses `proc_macro2::TokenStream` into syntax tree nodes  
- `parse_str()` (L950-952) - Parses string source code into syntax tree nodes
- `parse_file()` (L985-1009) - Specialized file parser handling BOM and shebang lines

### Module Structure by Features
- **derive** (L357-360) - Core data structures for derive macros (`DeriveInput`, `Data`, etc.)
- **full** (L389-393) - Complete Rust syntax support including expressions, items, statements
- **parsing** (L468-470) - Parser infrastructure and utilities
- **printing** - Code generation capabilities (conditionally compiled)
- **visit/visit-mut/fold** (L552-866) - Syntax tree traversal and transformation traits

### Core Data Types (conditionally exported)
- **Expressions** (L367-385): `Expr`, `ExprBinary`, `ExprCall`, `ExprMacro`, etc.
- **Items** (L421-432): `Item`, `ItemFn`, `ItemStruct`, `ItemTrait`, etc. (full feature)
- **Types** (L535-543): `Type`, `TypePath`, `TypeReference`, etc.
- **Generics** (L398-415): `Generics`, `TypeParam`, `WhereClause`, etc.
- **Patterns** (L478-485): `Pat`, `PatIdent`, `PatStruct`, etc. (full feature)

### Generated Traits (L552-866)
- `fold::Fold` - Owned syntax tree transformation
- `visit::Visit` - Immutable syntax tree traversal  
- `visit_mut::VisitMut` - Mutable syntax tree traversal

### Utility Modules
- `punctuated` (L505) - Punctuation-separated sequences
- `token` (L325-326) - Token type definitions
- `buffer` (L336-338) - Parsing buffer utilities
- `spanned` (L520-522) - Span information handling

## Key Dependencies
- `proc_macro2` - Token stream handling
- Feature-gated `proc_macro` integration (L315-316)

## Design Patterns
- Aggressive feature gating to minimize compilation overhead
- Consistent `Result<T>` error handling via `Error` type (L364-365)
- Span preservation for accurate error reporting
- Modular parser functions with `fn(ParseStream) -> Result<T>` signature

## Critical Features
- **derive** (default) - Basic derive macro support
- **full** - Complete Rust syntax parsing
- **parsing** (default) - Core parsing functionality  
- **printing** (default) - Syntax tree to token conversion
- **proc-macro** (default) - Integration with procedural macros