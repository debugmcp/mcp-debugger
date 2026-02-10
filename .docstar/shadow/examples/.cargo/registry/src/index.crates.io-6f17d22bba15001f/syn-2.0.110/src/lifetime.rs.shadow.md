# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/syn-2.0.110/src/lifetime.rs
@source-hash: ec748fdbdedeb75c
@generated: 2026-02-09T18:11:52Z

**Primary Purpose**: Defines the `Lifetime` struct representing Rust lifetime parameters (`'a`, `'static`) in the syn AST, with complete parsing, printing, and comparison capabilities.

**Core Structure**:
- `Lifetime` struct (L18-21): Contains `apostrophe` span and `ident` for the lifetime name
- Enforces Rust lifetime naming rules: starts with `'`, followed by valid XID identifiers

**Key Functions**:
- `Lifetime::new()` (L38-58): Constructor with validation - panics on invalid lifetime names
- `span()` (L60-64): Returns combined span of apostrophe and identifier
- `set_span()` (L66-69): Updates spans for both apostrophe and identifier

**Trait Implementations**:
- `Display` (L72-77): Formats as `'` + identifier
- `Clone` (L79-86): Deep clone with span preservation
- Comparison traits (L88-106): Compare by identifier only, ignoring spans
- `Hash` (L108-112): Hash by identifier only
- `Parse` (L130-138): Parses lifetime tokens from input stream (parsing feature)
- `ToTokens` (L149-154): Converts back to token stream (printing feature)

**Dependencies**:
- `proc_macro2::{Ident, Span}` for token representation
- `crate::ident::xid_ok()` for identifier validation
- Feature-gated parsing/printing modules

**Architecture Notes**:
- Spans are preserved separately for apostrophe and identifier
- Equality/ordering based on identifier content only, not source location
- Validation enforces Unicode XID_Start/XID_Continue rules
- Conditional compilation for parsing/printing features

**Critical Invariants**:
- Lifetime names must start with `'` and follow XID naming rules
- Cannot be just `'` (empty lifetime)
- Spans must be properly maintained across operations