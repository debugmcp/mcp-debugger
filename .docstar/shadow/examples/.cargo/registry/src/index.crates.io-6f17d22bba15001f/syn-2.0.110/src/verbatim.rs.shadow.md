# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/syn-2.0.110/src/verbatim.rs
@source-hash: 4aa06d0ce2f6b6c6
@generated: 2026-02-09T18:11:56Z

**Purpose:** Extracts tokens between two parse positions in a token stream, handling transparent None-delimited groups.

**Core Function:**
- `between()` (L6-33): Extracts all tokens between two ParseStream positions
  - Parameters: `begin` and `end` ParseStream positions
  - Returns: TokenStream containing tokens in the range
  - Validates both positions are from same buffer (L9)
  - Iterates through tokens using cursors (L12-31)

**Key Logic:**
- Token extraction loop (L12-31): Advances cursor until reaching end position
- None-delimited group handling (L15-27): Special case for transparent groups
  - When end position is inside a None-delimited group, enters the group (L20-23)
  - Panics if end is inside other delimited groups (L25)
- Token accumulation (L29): Appends each token tree to result stream

**Dependencies:**
- `crate::ext::TokenStreamExt`: For token stream extensions
- `crate::parse::ParseStream`: Parser stream type
- `proc_macro2`: Core token manipulation (TokenStream, Delimiter)
- `crate::buffer`: Buffer comparison utilities

**Critical Invariants:**
- Begin and end positions must be from same token buffer
- End position must not be inside delimited groups (except None-delimited)
- None-delimited groups are treated as transparent to parsing

**Architecture Notes:**
- Handles edge case where syntax nodes cross None-delimited group boundaries
- References GitHub issue #1235 for semantic justification of None-group transparency
- Uses cursor-based iteration for efficient token traversal