# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/syn-2.0.110/src/generics.rs
@source-hash: 6170b4a9d82ba27a
@generated: 2026-02-09T18:12:01Z

This file defines the core AST structures and operations for Rust generics, type parameters, lifetimes, and where clauses within the syn crate (Rust syntax parsing library).

## Core Types

**Generics (L26-32)**: Primary container for generic parameters with optional angle brackets and where clause. Contains `Punctuated<GenericParam>` for parameters and optional `WhereClause`.

**GenericParam (L44-54)**: Enum discriminating between:
- `Lifetime(LifetimeParam)` - lifetime parameters like `'a: 'b`
- `Type(TypeParam)` - type parameters like `T: Send`  
- `Const(ConstParam)` - const generics like `const N: usize`

**Parameter Types**:
- **LifetimeParam (L59-65)**: Lifetime with optional bounds (`'a: 'b + 'c`)
- **TypeParam (L70-78)**: Type parameter with optional bounds and default (`T: Clone = String`)
- **ConstParam (L83-92)**: Const parameter with type and optional default (`const N: usize = 42`)

**Bounds and Constraints**:
- **TypeParamBound (L402-408)**: Enum for trait bounds, lifetimes, precise capture, or verbatim tokens
- **TraitBound (L413-421)**: Trait constraint with optional parentheses, modifier, lifetimes, and path
- **WhereClause (L465-469)**: Contains `where` token and punctuated predicates
- **WherePredicate (L481-488)**: Either lifetime or type predicate

## Key Methods

**Generics Implementation (L105-183)**:
- `lifetimes()`, `type_params()`, `const_params()` (L108-146): Filtered iterators over parameter types
- `make_where_clause()` (L149-154): Initializes where clause if absent
- `split_for_impl()` (L176-182): Returns tuple for impl syntax generation

**Iterator Types (L185-267)**: Specialized iterators that filter `GenericParam` enum variants:
- `Lifetimes`, `TypeParams`, `ConstParams` with mutable variants
- Each implements recursive `next()` that skips non-matching variants

**Printing Support (L269-291)**: Helper types for code generation:
- `ImplGenerics`, `TypeGenerics`, `Turbofish` - wrapper types for different contexts
- `TypeGenerics::as_turbofish()` (L347-349): Converts to turbofish syntax

## Feature-Gated Functionality

**Precise Capture (L433-459)**: `use<'a, T>` syntax for explicit lifetime/type capture (full feature only)
- `PreciseCapture` struct and `CapturedParam` enum

**Parsing Module (L514-1137)**: Comprehensive parsing implementations for all types
- Context-aware disambiguation (e.g., `choose_generics_over_qpath` L1097-1129)
- Handles complex syntax edge cases like `<T>::associated` vs `<T>` generics

**Printing Module (L1139-1477)**: Token stream generation with proper formatting
- Lifetime-first ordering in output regardless of input order
- Context-specific omission of defaults and bounds
- Const argument printing with error correction via braces

## Architecture Notes

Uses syn's `ast_struct!` and `ast_enum_of_structs!` macros for consistent AST node generation. Heavy use of `Punctuated` for comma-separated lists. Conditional compilation extensively used for feature gates (`full`, `derive`, `parsing`, `printing`).

The `generics_wrapper_impls!` macro (L294-335) generates standard trait implementations for printing helper types.