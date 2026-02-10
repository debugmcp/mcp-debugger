# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-macros-2.6.0/src/select.rs
@source-hash: a8af3f0dbc3ac310
@generated: 2026-02-09T18:12:37Z

## Primary Purpose
Procedural macro utilities for Tokio's `select!` macro implementation. Provides code generation for enum variants representing select branches and pattern cleaning functionality to sanitize user-provided patterns.

## Key Functions

### declare_output_enum (L6-43)
Generates an output enum and mask type for select branches:
- **Input**: TokenStream containing `(_ _ _)` with one `_` per branch
- **Logic**: 
  - Counts branches from grouped tokens (L8-11)
  - Creates variant identifiers `_0`, `_1`, etc. (L13-15)
  - Selects appropriate bitmask type based on branch count: u8 (≤8), u16 (≤16), u32 (≤32), u64 (≤64) (L18-31)
  - Panics if >64 branches (L28)
- **Output**: Generated enum `Out<_0, _1, ...>` with variants plus `Disabled` variant, and type alias `Mask`

### clean_pattern_macro (L45-56)
Entry point for pattern sanitization:
- Attempts to parse input as syn::Pat (L49-52)
- Falls back to returning original input if parsing fails
- Delegates to `clean_pattern` for actual cleaning

### clean_pattern (L59-109)
Recursively removes `ref` and `mut` modifiers from patterns:
- **Target modifiers**: `by_ref` and `mutability` fields in various pattern types
- **Recursive cases**: Processes nested patterns in Or (L75-79), Slice (L80-84), Struct (L85-89), Tuple (L90-94), TupleStruct (L95-99), Reference (L100-103), Type (L104-106), and Ident subpatterns (L71-73)
- **Base cases**: No-op for literals, macros, paths, ranges, rest, verbatim, and wild patterns

## Dependencies
- `proc_macro`: TokenStream manipulation
- `proc_macro2`: Span generation 
- `quote`: Code generation
- `syn`: AST parsing and manipulation

## Architectural Decisions
- Uses bitfield masks for efficient branch tracking with size optimization
- Pattern cleaning ensures compatibility with select macro's pattern matching requirements
- Graceful fallback in pattern parsing prevents macro expansion failures

## Constraints
- Maximum 64 select branches supported (hard limit)
- Pattern cleaning is destructive (removes ref/mut information permanently)