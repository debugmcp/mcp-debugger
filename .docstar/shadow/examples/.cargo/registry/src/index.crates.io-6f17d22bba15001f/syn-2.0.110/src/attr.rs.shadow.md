# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/syn-2.0.110/src/attr.rs
@source-hash: f44ff3cb9d3bc34d
@generated: 2026-02-09T18:11:57Z

## Primary Purpose

This module defines the AST representation and parsing/printing functionality for Rust attributes (`#[...]` and `#![...]`). Part of the `syn` crate's syntax tree implementation for procedural macros.

## Core Data Structures

**Attribute (L173-178)**: Main struct representing any Rust attribute
- `pound_token`: The `#` token
- `style`: `AttrStyle` enum distinguishing outer vs inner attributes
- `bracket_token`: Square brackets `[]`
- `meta`: The structured content within brackets

**AttrStyle (L445-448)**: Enum differentiating attribute placement
- `Outer`: Standard attributes like `#[derive(Clone)]`
- `Inner(Token![!])`: Inner attributes like `#![feature(proc_macro)]`

**Meta (L473-481)**: Enum representing the three forms of attribute content
- `Path`: Simple path like `test` in `#[test]`
- `List(MetaList)`: Parenthesized content like `derive(Copy, Clone)`
- `NameValue(MetaNameValue)`: Key-value pairs like `path = "file.rs"`

**MetaList (L487-491)**: Structured list attributes
- `path`: The attribute name
- `delimiter`: Parentheses, brackets, or braces
- `tokens`: Raw token stream of the content

**MetaNameValue (L497-501)**: Key-value attribute format
- `path`: The attribute name
- `eq_token`: The `=` token
- `value`: Expression representing the value

## Key Methods

**Attribute::path() (L186-188)**: Returns the identifying path of any attribute type

**Attribute::parse_args<T>() (L222-224)**: Parses attribute arguments into a specific type T, expects `Meta::List` format

**Attribute::parse_args_with() (L245-266)**: Custom parser variant with detailed error handling for wrong attribute formats

**Attribute::parse_nested_meta() (L391-396)**: Parses conventional meta-item attribute syntax using a callback approach for structured parsing

**Attribute::parse_outer() (L406-412)**: Static method parsing zero or more outer attributes from token stream

**Attribute::parse_inner() (L422-426)**: Static method parsing zero or more inner attributes from token stream

**Meta validation methods (L520-563)**:
- `require_path_only()`: Ensures Meta is just a path
- `require_list()`: Ensures Meta is a list with arguments  
- `require_name_value()`: Ensures Meta is a name-value pair

## Parsing Implementation

**parsing module (L647-786)**: Contains Parse trait implementations and helper functions
- `single_parse_inner/outer()` (L666-684): Core parsing logic for individual attributes
- `parse_meta_after_path()` (L721-729): Determines Meta variant based on following tokens
- `parse_outermost_meta_path()` (L712-719): Handles special case of `unsafe` keyword in attributes
- Display helpers for error messages (L762-785)

## Printing Implementation

**printing module (L789-836)**: ToTokens implementations for reconstructing attribute syntax
- Each struct implements `to_tokens()` to emit proper attribute syntax

**FilterAttrs trait (L594-626)**: Utility for separating outer vs inner attributes from attribute collections

## Architectural Notes

- Extensive feature gating with `#[cfg(feature = "parsing")]` and `#[cfg(feature = "printing")]`
- Uses `ast_struct!` and `ast_enum!` macros for consistent AST node generation
- Doc comments are normalized to `#[doc = "..."]` NameValue attributes during compilation
- Supports all Rust attribute syntactic forms including doc comments
- Error handling provides context-aware messages for common attribute parsing mistakes
- Speculative parsing used in MetaNameValue to handle literal vs expression values