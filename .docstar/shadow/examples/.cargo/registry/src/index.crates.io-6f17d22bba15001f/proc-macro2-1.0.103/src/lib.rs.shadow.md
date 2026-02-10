# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/proc-macro2-1.0.103/src/lib.rs
@source-hash: c07a2ad1ccbda629
@generated: 2026-02-09T18:11:56Z

## Primary Purpose
proc-macro2 is a compatibility layer providing portable procedural macro APIs. It enables proc-macro-like functionality outside of procedural macro contexts (main.rs, build.rs) and makes procedural macros unit testable. This is the main library entry point wrapping the compiler's proc_macro APIs.

## Key Types and Structures

### Core Token Types
- **TokenStream** (L197-240): Main token sequence type with iterator support and conversion to/from proc_macro::TokenStream
  - `new()` (L232-234): Creates empty token stream
  - `is_empty()` (L237-239): Checks if stream contains tokens
  - Implements FromStr (L258-270), Display (L323-327), Debug (L330-334), collection traits

- **TokenTree** (L544-582): Enum representing single tokens or delimited sequences
  - Variants: Group, Ident, Punct, Literal
  - `span()` (L560-567): Returns span of contained token
  - `set_span()` (L574-581): Configures span for token
  - Implements From conversions for all variants (L584-606)

- **Span** (L356-535): Source location and hygiene information
  - `call_site()` (L383-385): Call-site hygiene span
  - `mixed_site()` (L390-392): Mixed hygiene like macro_rules
  - `def_site()` (L397-401): Definition-site hygiene [semver exempt]
  - Location methods require "span-locations" feature (L446-503)

### Token Component Types
- **Group** (L642-765): Delimited token sequences with Delimiter enum (L651-680)
  - `new()` (L698-702): Creates group with delimiter and stream
  - `stream()` (L714-716): Returns inner token stream
  - Span methods for delimiters: `span_open()`, `span_close()`, `delim_span()`

- **Punct** (L782-869): Single punctuation characters with spacing information
  - `new()` (L814-826): Creates punct with character and Spacing
  - Spacing enum: Alone, Joint for multi-character operators

- **Ident** (L871-1061): Rust identifiers with hygiene support
  - `new()` (L988-990): Creates identifier with string and span
  - `new_raw()` (L998-1000): Creates raw identifier (r#ident)
  - Implements comparison and hashing based on string representation

- **Literal** (L1063-1418): Numeric, string, and character literals
  - Factory methods for all literal types (suffixed/unsuffixed integers, floats, strings)
  - String value extraction methods [semver exempt] (L1278-1382)

### Iterator Support
- **token_stream::IntoIter** (L1455-1494): Shallow iterator over TokenStream's TokenTrees

## Configuration Features

### Conditional Compilation
- `wrap_proc_macro` cfg: Use native proc_macro when available vs fallback implementation
- `procmacro2_semver_exempt` cfg: Enable unstable/nightly-only APIs (L67-78)
- `span_locations` cfg: Enable span location methods
- Feature gates control API availability based on compiler version

### Module Structure
- **fallback** (L154): Fallback implementation when proc_macro unavailable
- **imp**: Either fallback or wrapper.rs based on wrap_proc_macro cfg (L158-162)
- **extra** (L156): Additional utilities like DelimSpan
- Conditional modules: detection, location, num, rustc_literal_escaper

## Error Types
- **LexError** (L210-354): Tokenization errors with span information
- **ConversionErrorKind** (L1420-1430): String literal conversion errors [semver exempt]

## Key Architectural Decisions
- Dual implementation strategy: native proc_macro wrapper vs pure Rust fallback
- Extensive use of marker types (ProcMacroAutoTraits) for trait auto-implementation control
- Feature-gated APIs to maintain compatibility across Rust versions
- Semver-exempt APIs clearly marked and conditionally compiled
- Comprehensive trait implementations for ergonomic usage (Display, Debug, FromStr, etc.)

## Critical Invariants
- All types maintain span information for proper error reporting
- TokenStream roundtrip fidelity (modulo spans and None delimiters)
- Hygiene behavior matches proc_macro semantics
- Thread safety: Most types are !Sync due to thread-local compiler state (L82-84)