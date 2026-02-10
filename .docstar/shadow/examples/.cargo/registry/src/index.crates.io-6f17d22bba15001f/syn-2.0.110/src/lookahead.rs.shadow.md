# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/syn-2.0.110/src/lookahead.rs
@source-hash: b2837d80fa4466bb
@generated: 2026-02-09T18:11:55Z

**Purpose**: Lookahead parsing utilities for the Syn crate, enabling parser decision-making based on upcoming tokens with automatic error message generation.

**Core Type**: `Lookahead1<'a>` (L63-67) - Main lookahead structure containing:
- `scope`: Span for error context
- `cursor`: Current parse position
- `comparisons`: RefCell tracking peeked token types for error messages

**Key Functions**:
- `new()` (L69-75): Creates new Lookahead1 instance
- `peek_impl()` (L77-87): Core implementation checking token match and recording comparisons
- `Lookahead1::peek<T: Peek>()` (L104-107): Public interface for token lookahead using Peek trait
- `Lookahead1::error()` (L113-147): Generates contextual error messages based on accumulated peek attempts

**Error Generation Logic** (L113-147):
- Handles delimiter-specific error messages (parentheses/braces/brackets)
- Formats errors based on comparison count:
  - 0 comparisons: "unexpected end of input" or "unexpected token"
  - 1 comparison: "expected {token}"
  - 2 comparisons: "expected {token1} or {token2}"  
  - 3+ comparisons: "expected one of: {comma-separated list}"

**Supporting Types**:
- `CommaSeparated<'a>` (L150-164): Display formatter for multi-token error lists
- `Peek` trait (L174-178): Sealed trait for types that can be peeked (single token lookahead)
- `End` (L310-332): Pseudo-token for detecting end-of-stream
- `TokenMarker` (L338-344): Zero-sized marker type for generic token construction

**Architecture Pattern**: Uses RefCell for interior mutability to track peek attempts across immutable references, enabling automatic error message construction without requiring mutable access to the lookahead object.

**Key Dependencies**:
- `crate::buffer::Cursor`: Parse position tracking
- `crate::error::Error`: Error construction utilities  
- `crate::token::Token`: Token trait system
- `proc_macro2::Delimiter`: Delimiter type identification