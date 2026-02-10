# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/syn-2.0.110/src/discouraged.rs
@source-hash: 653c5d9e6c4e3c23
@generated: 2026-02-09T18:12:18Z

## Purpose
Provides discouraged but sometimes necessary parsing extensions for the syn crate, specifically speculative parsing and delimiter manipulation. These APIs enable advanced parsing patterns that should be avoided when possible due to their impact on error quality.

## Core Components

### Speculative Trait (L12-165)
Extension trait for ParseStream enabling speculative parsing with fork/commit pattern.

**Key Method:**
- `advance_to(&self, fork: &Self)` (L164): Commits a forked parse stream's position to the original stream. Enables parsing ambiguous syntax like `A* B*` where grammar overlap requires lookahead.

**Critical Constraints:**
- Fork must be derived from the advancing stream (panic if violated, L170)
- Performs O(1) work regardless of stream position delta
- Degrades error quality by showing fallback parse errors instead of speculative ones

### ParseBuffer Implementation (L167-201)
Implements `Speculative` for `ParseBuffer<'a>` with complex error propagation logic.

**Error Handling Logic (L173-195):**
- Manages `Unexpected` token chains between fork and parent
- Propagates error context while preventing toplevel unexpected tokens from fork
- Uses `Rc::ptr_eq` to detect shared error state

**Memory Management (L198-200):**
Uses unsafe transmute to update cursor position - requires careful lifetime management.

### AnyDelimiter Trait (L203-225)
Extension for parsing any delimiter type (including invisible ones).

**Key Method:**
- `parse_any_delimiter()` (L212-224): Returns `(Delimiter, DelimSpan, ParseBuffer)` tuple for nested parsing of delimited content

## Dependencies
- `crate::buffer::Cursor` - cursor-based parsing position
- `crate::parse` - core parsing infrastructure and error handling
- `proc_macro2` - token stream and delimiter handling
- `std::{cell::Cell, mem, rc::Rc}` - shared state and memory management

## Usage Patterns
**Speculative Parsing Example (L76-106):** PathSegment parsing that speculatively tries to parse generic arguments after `<`, falling back to treating `<` as less-than operator.

**Trade-offs:**
- Enables parsing complex ambiguous grammars
- Significantly degrades error message quality
- Should be avoided when LL(3) parsing is possible

## Architecture Notes
- Uses reference counting and interior mutability for error propagation
- Unsafe transmute requires static lifetime bounds for cursor advancement
- Error chaining mechanism preserves parse context across forks