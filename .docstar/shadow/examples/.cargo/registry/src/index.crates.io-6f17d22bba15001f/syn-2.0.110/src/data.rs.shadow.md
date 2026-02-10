# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/syn-2.0.110/src/data.rs
@source-hash: fa04dce757ca3dd1
@generated: 2026-02-09T18:12:23Z

## Primary Purpose
Defines AST data structures for representing Rust struct and enum field data in the `syn` parser crate. This module provides the core types for modeling field collections, individual fields, and enum variants with their associated parsing and token generation capabilities.

## Key Types and Structures

### Core AST Types
- **`Variant` (L12-24)**: Represents an enum variant with attributes, identifier, fields, and optional discriminant
- **`Fields` (L35-46)**: Enum representing the three types of field collections:
  - `Named(FieldsNamed)`: Braced struct fields like `{ x: i32, y: i32 }`
  - `Unnamed(FieldsUnnamed)`: Tuple struct fields like `(i32, i32)`
  - `Unit`: Zero fields
- **`FieldsNamed` (L52-56)**: Named field collection with brace tokens and comma-separated fields
- **`FieldsUnnamed` (L61-65)**: Unnamed field collection with paren tokens and comma-separated fields
- **`Field` (L184-200)**: Individual field with attributes, visibility, mutability, optional identifier, colon token, and type

### Utility Types
- **`Members` (L202-205)**: Iterator helper that converts fields to `Member` enum values for uniform access

## Key Methods and Implementations

### Fields Iterator Methods (L67-148)
- `iter()` (L71-77): Returns iterator over borrowed fields, handles all three field types
- `iter_mut()` (L82-88): Returns mutable iterator over fields
- `len()` (L91-97): Returns field count (0 for Unit)
- `is_empty()` (L100-106): Checks if no fields present
- `members()` (L141-147): Returns iterator converting fields to `Member` enum for uniform field access

### IntoIterator Implementations (L150-179)
- Owned, borrowed, and mutable borrowed iterator implementations for `Fields`
- Delegates to underlying punctuated collections or creates empty iterators for Unit

### Members Iterator (L207-228)
- Converts fields to `Member::Named(ident)` or `Member::Unnamed(Index)` based on field type
- Tracks numeric index for unnamed fields
- Handles span information conditionally based on feature flags

## Feature-Gated Modules

### Parsing Module (L240-372)
Conditional compilation with `#[cfg(feature = "parsing")]`
- **`Variant::parse()` (L258-297)**: Parses enum variants, handles discriminant expressions with fallback to verbatim
- **`FieldsNamed::parse()` (L300-308)**: Parses braced field lists
- **`FieldsUnnamed::parse()` (L311-319)**: Parses parenthesized field lists  
- **`Field::parse_named()` (L324-357)**: Parses named fields with special handling for unnamed struct/union fields
- **`Field::parse_unnamed()` (L361-371)**: Parses tuple struct fields

### Printing Module (L375-424)
Conditional compilation with `#[cfg(feature = "printing")]`
- **`ToTokens` implementations**: Convert AST back to token streams for code generation
- Handles proper token positioning and punctuation reconstruction

## Dependencies and Integration
- Imports core syn types: `Attribute`, `Expr`, `Ident`, `Type`, `Visibility`
- Uses `Punctuated` for comma-separated field collections
- Integrates with `Member` and `Index` for uniform field access
- Conditional dependencies on parsing and printing infrastructure

## Architectural Patterns
- Uses `ast_struct!` and `ast_enum_of_structs!` macros for consistent AST node generation
- Implements uniform iteration interfaces across different field container types
- Feature-gated parsing and printing to support minimal builds
- Leverages punctuated collections for proper delimiter handling