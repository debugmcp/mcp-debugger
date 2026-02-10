# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/syn-2.0.110/src/path.rs
@source-hash: 2146bdf5e0eb6991
@generated: 2026-02-09T18:12:22Z

## Primary Purpose
AST representation for Rust paths and their components in the `syn` crate. Handles parsing and printing of module paths (`std::collections::HashMap`), generic arguments, qualified paths (`<T as Trait>::method`), and associated type/const bindings.

## Key Types

### Path (L14-18)
Core path representation with optional leading `::` and punctuated segments. Includes convenience methods:
- `is_ident()` (L63-72): Checks if path is single identifier without generics
- `get_ident()` (L82-91): Returns identifier if path is simple single segment  
- `require_ident()` (L96-104): Parse-time validation requiring single identifier

### PathSegment (L110-114)
Individual path component containing identifier and optional arguments. Converts from any `Into<Ident>` type (L116-126).

### PathArguments (L139-146)
Enum for segment arguments:
- `None`: No arguments
- `AngleBracketed`: Generic arguments like `<T, U>` 
- `Parenthesized`: Function-style arguments like `(A, B) -> C`

Utility methods `is_empty()` (L155-161) and `is_none()` (L163-169).

### GenericArgument (L175-194)
Enum for individual generic arguments:
- `Lifetime`, `Type`, `Const` for basic arguments
- `AssocType`, `AssocConst` for associated bindings (`Item = T`)
- `Constraint` for trait bounds (`Item: Display`)

### AngleBracketedGenericArguments (L200-206)
Represents `<...>` syntax with optional leading `::`, contains punctuated generic arguments.

### QSelf (L274-281)
Qualified self type for syntax like `<Vec<T> as Iterator>::Item`. Contains position field indicating where qualification applies in the path.

## Parsing Module (L284-697)
Feature-gated parsing implementations:

### Key Functions
- `Path::parse_mod_style()` (L579-609): Parses module-style paths without generics
- `Path::parse_helper()` (L611-623): Core path parsing with expression style flag
- `const_argument()` (L409-445): Parses constant expressions in generic arguments
- `qpath()` (L646-696): Parses qualified paths with `<Type as Trait>` syntax

### GenericArgument Parsing (L316-407)
Complex parsing logic that disambiguates between types, lifetimes, const expressions, and associated type/const bindings based on lookahead.

## Printing Module (L700-966)
Feature-gated printing implementations with `PathStyle` enum (L715-719) controlling output format:
- `Expr`: Expression context (preserves turbofish)
- `Mod`: Module context (strips generics) 
- `AsWritten`: Preserves original formatting

Key printing functions handle proper ordering of lifetime vs type arguments and conditional turbofish syntax.

## Dependencies
- `punctuated::Punctuated` for comma-separated sequences
- `token` types for syntax tokens
- `ident::Ident` for identifiers  
- `ty::Type` for type references
- `expr::Expr` for constant expressions
- `generics::TypeParamBound` for trait bounds
- `lifetime::Lifetime` for lifetime parameters

## Architecture Notes
- Uses `ast_struct!` and `ast_enum!` macros for AST node definitions
- Feature-gated parsing/printing modules for optional functionality
- Conversion traits (`From`, `Into`) for ergonomic construction
- Spanned trait implementation for source location tracking