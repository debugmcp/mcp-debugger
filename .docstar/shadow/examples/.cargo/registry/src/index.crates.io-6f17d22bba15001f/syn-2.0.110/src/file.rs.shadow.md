# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/syn-2.0.110/src/file.rs
@source-hash: 9d04206da5eff88e
@generated: 2026-02-09T18:11:51Z

## Primary Purpose
Defines the `File` struct representing a complete Rust source code file in the syn AST library. This is the top-level AST node for parsing entire Rust files.

## Core Structure
**File struct (L79-83)**: The main AST node containing:
- `shebang: Option<String>` - Optional shebang line (#!/usr/bin/env)
- `attrs: Vec<Attribute>` - File-level attributes (inner attributes like `#![...]`)
- `items: Vec<Item>` - Top-level items (functions, structs, modules, etc.)

## Key Implementations

### Parsing (L94-108)
**Parse trait implementation**: Parses token stream into File AST
- Parses inner attributes first using `Attribute::parse_inner()` (L98)
- Iteratively parses all remaining tokens as Items until stream is empty (L100-105)
- Note: Shebang is hardcoded to `None` in parser - shebang handling likely occurs at tokenization level

### Printing (L119-124) 
**ToTokens trait implementation**: Converts File AST back to tokens
- Outputs inner attributes first (L121)
- Outputs all items in sequence (L122)

## Dependencies
- `crate::attr::Attribute` - For file-level attributes
- `crate::item::Item` - For top-level items
- `crate::parse::{Parse, ParseStream}` - Parser infrastructure
- `quote::ToTokens` - Token generation infrastructure

## Feature Gating
- Main struct available with `"full"` feature
- Parsing implementation gated by `"parsing"` feature (L86)
- Printing implementation gated by `"printing"` feature (L111)

## Usage Pattern
Typically instantiated via `syn::parse_file()` function (referenced in docs but defined elsewhere). Represents the root of a complete Rust syntax tree for file-level parsing operations.