# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/syn-2.0.110/tests/test_parse_buffer.rs
@source-hash: 0de6af13ba034598
@generated: 2026-02-09T18:12:05Z

## Primary Purpose
Test file for syn's ParseStream and parse buffer functionality, focusing on security boundaries and error handling in speculative parsing operations.

## Key Test Functions

### Security/Boundary Tests
- **smuggled_speculative_cursor_between_sources** (L11-24): Tests protection against illegally advancing ParseStream from one source to another unrelated source. Uses nested parser closure to attempt cross-source cursor smuggling.
- **smuggled_speculative_cursor_between_brackets** (L28-42): Verifies protection against advancing ParseStream between different bracketed contexts within same source. Creates two parenthesized groups and attempts invalid advance_to operation.
- **smuggled_speculative_cursor_into_brackets** (L46-58): Tests protection against advancing outer ParseStream to inner bracketed context. Attempts to advance main stream to parenthesized content cursor.

### Functional Tests  
- **trailing_empty_none_group** (L61-93): Tests parsing behavior with trailing empty delimiter groups. Constructs complex TokenStream with nested None-delimited empty groups to verify parser handles edge cases correctly.
- **test_unwind_safe** (L96-103): Verifies ParseStream operations are panic-safe by wrapping parse call in catch_unwind.

## Key Dependencies
- `proc_macro2`: Token manipulation (TokenStream, Group, Delimiter, etc.)
- `syn::parse`: Core parsing infrastructure (ParseStream, Parse trait)
- `syn::parse::discouraged::Speculative`: Advanced speculative parsing features
- `syn::parenthesized`: Macro for parsing parenthesized content

## Architecture Patterns
- **Security-first design**: Multiple tests ensure ParseStream cursors cannot be smuggled between different parsing contexts
- **Custom Parse implementations**: Each test defines minimal BreakRules struct implementing Parse trait to test specific violation scenarios
- **Expected panic testing**: Uses #[should_panic] with specific error messages to verify security boundaries

## Critical Invariants
- ParseStream cursors must only advance within their originating context
- Fork cursors must derive from the same advancing parse stream
- Parser operations must be unwind-safe for panic recovery