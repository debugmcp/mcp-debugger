# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/syn-2.0.110/tests/test_unparenthesize.rs
@source-hash: e5c047819afd5f70
@generated: 2026-02-09T18:12:09Z

**Primary Purpose:** Test suite that validates syn's ability to correctly round-trip Rust AST parsing and printing while preserving semantic equivalence after parentheses flattening.

**Core Architecture:**
- Integration test using real Rust codebase files from cloned rust repository
- Validates AST consistency through parse → flatten → print → parse → flatten → compare cycle
- Uses atomic counter for thread-safe failure tracking across parallel file processing

**Key Functions:**
- `test_unparenthesize()` (L26-39): Main test entry point that initializes rayon, clones rust repo, processes all files in parallel, and reports aggregate failures
- `test()` (L41-70): Core test logic for individual files - performs round-trip parsing with parentheses flattening and compares AST structures

**Critical Test Flow:**
1. Parse file content into syn::File AST (L45)
2. Apply FlattenParens visitor to remove unnecessary parentheses (L46)
3. Convert AST back to token stream and reparse (L47-48)
4. Apply FlattenParens again to second AST (L49)
5. Normalize both ASTs with AsIfPrinted visitor (L51)
6. Compare for structural equality (L52)

**Dependencies:**
- `syn` crate for Rust parsing/AST manipulation
- `quote` for token stream generation
- Custom visitors: `FlattenParens` and `AsIfPrinted` from common::visit module
- repo module for Rust source file discovery and parallel processing
- macros module (likely for errorf! macro used in L53-65)

**Error Handling:**
- Panic catching to handle syn parser panics (L44-59)
- Parse error handling for malformed input (L64-67)
- Thread-safe failure counting with detailed first-failure debugging (L54-56)

**Test Configuration:**
- Disabled under miri (L1)
- High recursion limit for deep AST structures (L2)
- Multiple clippy warning suppressions for test-specific patterns (L4-10)