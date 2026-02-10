# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/syn-2.0.110/src/punctuated.rs
@source-hash: 711c1f9122f56053
@generated: 2026-02-09T18:12:09Z

This file implements `Punctuated<T, P>`, a specialized collection for storing sequences of syntax tree nodes separated by punctuation tokens - a fundamental building block for parsing Rust's comma-separated, colon-separated, and plus-separated syntax constructs.

## Core Architecture

**Punctuated<T, P> struct (L49-52)**: Stores punctuated sequences using:
- `inner: Vec<(T, P)>` - pairs of (node, punctuation) for all but possibly the last element
- `last: Option<Box<T>>` - optional final element without trailing punctuation

This design efficiently handles both trailing and non-trailing punctuation cases while minimizing allocations.

## Key Methods

**Creation & Access (L56-118)**:
- `new()` (L56) - creates empty sequence
- `is_empty()`, `len()` (L65, L73) - size queries
- `first()`, `last()`, `get()` (L78, L88, L98) - element access with mutable variants
- Indexing via `Index`/`IndexMut` traits (L1078-1104)

**Modification (L180-283)**:
- `push_value()` (L180) - appends node, requires existing trailing punct or empty sequence
- `push_punct()` (L196) - appends punctuation, requires non-empty sequence without trailing punct
- `push()` (L247) - convenience method that adds default punctuation if needed
- `pop()`, `pop_punct()` (L208, L218) - removal operations
- `insert()`, `clear()` (L263, L280) - bulk operations

**State Queries (L230-240)**:
- `trailing_punct()` (L230) - checks if sequence ends with punctuation
- `empty_or_trailing()` (L238) - helper for determining if new values can be pushed

## Iterator Types

**Pairs Iterators** - iterate over `Pair<T, P>` enum variants:
- `Pairs` (L567) - borrowed pairs `Pair<&T, &P>`
- `PairsMut` (L617) - mutably borrowed pairs  
- `IntoPairs` (L657) - owned pairs

**Value Iterators** - iterate over just the `T` values:
- `Iter` (L754) - borrowed values `&T` using trait object for type erasure
- `IterMut` (L868) - mutably borrowed values `&mut T`
- `IntoIter` (L710) - owned values `T`

**Pair<T, P> enum (L958-961)**: Represents either `Punctuated(T, P)` or `End(T)` for final elements.

## Parsing Integration

**Parsing methods (L292-382)** (requires "parsing" feature):
- `parse_terminated()` (L292) - parses zero or more `T` separated by `P`, allows trailing punct
- `parse_separated_nonempty()` (L344) - parses one or more `T` separated by `P`, no trailing punct
- Both have `_with` variants accepting custom parser functions

## Trait Implementations

**Collection traits**: `FromIterator`, `Extend`, `IntoIterator`, `Default`
**Conditional traits** (feature-gated): `Clone`, `Debug`, `PartialEq`, `Eq`, `Hash`
**Printing** (L1137-1169): `ToTokens` implementation for code generation

## Internal Utilities

**Fold support (L1107-1134)**: Internal function for AST transformations using `VecDeque` for efficient reordering
**Empty iterators (L775, L890)**: Factory functions for creating empty iterators
**Type erasure**: Uses `NoDrop` wrapper and trait objects to handle complex iterator lifetimes

## Dependencies

Key imports: `crate::drops::{NoDrop, TrivialDrop}` for memory management, conditional imports for parsing (`Parse`, `ParseStream`), folding (`VecDeque`), and traits (`Debug`, `Hash`).

This type is essential for representing any comma-separated list in Rust syntax trees (function arguments, struct fields, generic bounds, etc.) while preserving exact punctuation information for faithful code generation.