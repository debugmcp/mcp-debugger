# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/syn-2.0.110/src/macros.rs
@source-hash: 2a6e895dfe1c3a9a
@generated: 2026-02-09T18:12:00Z

**Purpose**: Macro utilities for generating AST structures and implementations in the syn crate, providing feature-conditional code generation for parser types.

## Core Macros

**ast_struct (L5-38)**: Generates struct definitions with feature-conditional bodies
- With `#full` flag: Creates full struct when "full" feature enabled, stub struct with `PhantomData` otherwise (L13-19)
- Adds unreachable `ToTokens` impl for stubs when "printing" feature enabled (L21-26)
- Without flag: Always generates complete struct (L32-36)
- Uses `check_keyword_matches!` for keyword validation

**ast_enum (L41-51)**: Simple enum generator (requires "full" or "derive" features)
- Validates keywords and applies attributes directly to enum definition

**ast_enum_of_structs (L53-68)**: Enhanced enum generator for structural variants
- Generates enum definition (L61)
- Calls `ast_enum_of_structs_impl!` to create From implementations (L63)
- Conditionally generates `ToTokens` implementation via `generate_to_tokens!` (L65-66)

## Implementation Generators

**ast_enum_of_structs_impl (L70-84)**: Parses enum body and generates From implementations
- Extracts variant names and member types from enum definition
- Delegates to `ast_enum_from_struct!` for each variant

**ast_enum_from_struct (L86-97)**: Creates From<T> implementations for enum variants
- Special case: Skips Verbatim variants (L88)
- Standard case: Generates `From<Member> for Enum` converting to `Enum::Variant(member)` (L90-96)

**generate_to_tokens (L100-139)**: Recursive macro generating ToTokens implementations
- Processes enum variants incrementally, building match arms
- Unit variants: Generate empty match arms (L108-113)
- Tuple variants: Generate `_e.to_tokens(tokens)` calls (L122-127)
- Final case: Emits complete ToTokens impl with accumulated match arms (L129-138)

## Utility Macros

**pub_if_not_doc (L143-160)**: Conditional visibility modifier
- Doc build version: Forces pub(crate) visibility (L143-150)
- Non-doc version: Preserves original visibility (L152-160)

**check_keyword_matches (L162-166)**: Keyword validation helper
- Ensures macro parameters match expected keywords (enum, pub, struct)

**return_impl_trait (L169-181)**: Function signature abstraction
- Non-docs: Returns concrete type (L174-176)
- Docs: Returns impl trait type for better documentation (L178-180)

## Dependencies
- `::std::marker::PhantomData` for stub structs
- `::proc_macro2::{Span, TokenStream}` for token manipulation  
- `::quote::ToTokens` trait for code generation

## Architecture
Feature-driven conditional compilation system enabling lightweight parser types when full AST isn't needed, with automatic trait implementations for code generation scenarios.