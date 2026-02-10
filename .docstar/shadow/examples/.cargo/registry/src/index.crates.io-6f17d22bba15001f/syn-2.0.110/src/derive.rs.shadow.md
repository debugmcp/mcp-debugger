# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/syn-2.0.110/src/derive.rs
@source-hash: f54f8cf9386a2d45
@generated: 2026-02-09T18:12:17Z

## Primary Purpose

This file defines data structures and parsing/printing implementations for procedural macro derive inputs in the `syn` crate. It provides the fundamental AST nodes that represent Rust data structures (`struct`, `enum`, `union`) when processed by derive macros.

## Key Structures

**`DeriveInput` (L12-18)**: Main entry point representing any derivable data structure. Contains:
- `attrs`: Outer attributes on the item
- `vis`: Visibility modifier
- `ident`: Type name
- `generics`: Generic parameters and constraints  
- `data`: The actual data structure content (struct/enum/union)

**`Data` (L30-34)**: Discriminated union representing the three possible data structure types:
- `Struct(DataStruct)`: Struct variant
- `Enum(DataEnum)`: Enum variant  
- `Union(DataUnion)`: Union variant

**`DataStruct` (L40-44)**: Represents struct syntax with:
- `struct_token`: The `struct` keyword token
- `fields`: Field definitions (named, unnamed, or unit)
- `semi_token`: Optional semicolon for tuple/unit structs

**`DataEnum` (L50-54)**: Represents enum syntax with:
- `enum_token`: The `enum` keyword token
- `brace_token`: Surrounding braces
- `variants`: Comma-separated enum variants

**`DataUnion` (L60-63)**: Represents union syntax with:
- `union_token`: The `union` keyword token
- `fields`: Named fields only (unions require named fields)

## Parsing Implementation (L67-205)

The `parsing` module provides `Parse` trait implementations:

**`DeriveInput::parse` (L80-146)**: Main parsing entry point that:
1. Parses outer attributes
2. Parses visibility
3. Uses lookahead to determine data structure type (`struct`/`enum`/`union`)
4. Delegates to appropriate helper function
5. Constructs complete `DeriveInput` with proper generic handling

**Helper Functions**:
- `data_struct` (L148-182): Handles struct field parsing with complex where-clause positioning
- `data_enum` (L184-198): Parses enum variants within braces
- `data_union` (L200-204): Parses union fields (named only)

## Printing Implementation (L207-259)

The `printing` module provides `ToTokens` trait implementation:

**`DeriveInput::to_tokens` (L217-258)**: Reconstructs token stream by:
1. Emitting outer attributes
2. Emitting visibility and appropriate keyword token
3. Emitting identifier and generics
4. Handling data-specific formatting with proper where-clause placement

## Dependencies

- `crate::attr`: Attribute parsing and filtering
- `crate::data`: Field definitions and variants
- `crate::generics`: Generic parameters and where clauses
- `crate::punctuated`: Comma-separated sequences
- `proc_macro2`/`quote`: Token manipulation (printing only)

## Architectural Notes

- Uses `ast_struct!` and `ast_enum!` macros for consistent AST node generation
- Conditional compilation with `parsing` and `printing` features
- Complex where-clause positioning logic handles Rust's flexible syntax
- Lookahead-based parsing prevents backtracking
- Token-preserving design maintains exact source formatting