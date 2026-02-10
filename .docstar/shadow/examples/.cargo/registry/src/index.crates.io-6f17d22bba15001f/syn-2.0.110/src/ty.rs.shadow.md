# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/syn-2.0.110/src/ty.rs
@source-hash: b7daaf57dd96fc09
@generated: 2026-02-09T18:12:13Z

## Primary Purpose
Core type system representation for the `syn` crate. Defines the `Type` enum and associated structures that model Rust's type syntax, providing parsing and printing capabilities for procedural macros to analyze and generate Rust code.

## Architecture Overview
Built using `ast_enum_of_structs!` and `ast_struct!` macros to generate consistent AST nodes with feature-gated parsing/printing implementations. The design follows the visitor pattern with each type variant having its own dedicated struct.

## Key Types

### Core Type Enum
- **Type (L23-90)**: Non-exhaustive enum representing all possible Rust types
  - 15 variants covering: arrays, bare functions, groups, impl traits, inference, macros, never type, parenthesized, paths, pointers, references, slices, trait objects, tuples, and verbatim tokens
  - Includes guidance comment (L72-88) for downstream exhaustiveness testing

### Type Variants (L92-271)
- **TypeArray (L95-101)**: Fixed-size arrays `[T; n]` with bracket tokens, element type, semicolon, and length expression
- **TypeBareFn (L106-116)**: Function pointers with optional lifetimes, safety, ABI, parameters, variadic args, and return type
- **TypePath (L174-178)**: Most common type - paths like `std::Vec<T>` with optional qualified self-type
- **TypeReference (L194-200)**: Reference types `&T` or `&mut T` with optional lifetime
- **TypePtr (L183-189)**: Raw pointers `*const T` or `*mut T`
- **TypeTraitObject (L215-219)**: Dynamic trait objects `dyn Trait + Send`
- **TypeImplTrait (L131-135)**: `impl Trait` syntax for opaque types
- **TypeTuple (L224-228)**: Tuple types `(A, B, C)`

### Supporting Types
- **ReturnType (L263-271)**: Function return type enum (Default or explicit Type)
- **Abi (L233-237)**: Function ABI specification `extern "C"`
- **BareFnArg (L242-247)**: Function pointer arguments with optional names
- **BareVariadic (L252-258)**: Variadic function arguments `...`

## Parsing Implementation (L274-1069)
Comprehensive parsing logic with sophisticated type disambiguation:

### Core Parser
- **ambig_ty (L318-611)**: Main type parsing function with complex disambiguation logic
  - Handles group generics, lifetime bounds, trait objects vs parenthesized types
  - Uses lookahead to distinguish between similar syntactic forms
  - `allow_plus` parameter controls trait bound parsing in different contexts

### Key Parsing Methods
- **Type::without_plus (L311-316)**: Restricted parsing for contexts where `+` is ambiguous (e.g., cast expressions)
- **TypeTraitObject::parse_bounds (L842-878)**: Validates trait object bounds require at least one trait
- **TypeImplTrait::parse (L895-944)**: Ensures impl traits have at least one trait bound

### Specialized Parsers
Individual `Parse` implementations for each type variant (L614-1068) with context-aware parsing rules.

## Printing Implementation (L1072-1271)
`ToTokens` implementations for code generation:
- Handles proper token stream reconstruction with correct delimiters
- Special case for single-element tuples requiring trailing comma (L1164-1166)
- Preserves original formatting through token span information

## Dependencies
- **Internal**: `crate::{attr, expr, generics, ident, lifetime, lit, mac, path, punctuated, token}`
- **External**: `proc_macro2::TokenStream` for token manipulation
- **Conditional**: Feature-gated parsing/printing modules

## Critical Invariants
1. Non-exhaustive enum requires downstream fallback handling
2. Trait objects and impl traits must contain at least one trait bound
3. Single-element tuples need trailing commas for disambiguation
4. Reference types bind tighter than `+` operators in parsing precedence

## Usage Patterns
Primary entry point for type parsing in macro contexts. The `Type::parse()` method handles most common cases, while `Type::without_plus()` is used in expression contexts where trait bounds could be ambiguous.