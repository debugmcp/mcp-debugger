# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/syn-2.0.110/tests/test_parse_stream.rs
@source-hash: b6b533432173123d
@generated: 2026-02-09T18:12:04Z

**Primary Purpose**: Test suite for syn's ParseStream peek functionality, verifying lookahead behavior for tokens, lifetimes, identifiers, and grouped tokens.

**Key Test Functions**:
- `test_peek_punct` (L10-35): Tests peeking compound and individual punctuation tokens (`+=`, `+`, `=`). Verifies peek behavior changes after consuming tokens and distinguishes between joint/separate punctuation.

- `test_peek_lifetime` (L37-60): Tests lifetime token recognition with joint punctuation (`'static`). Uses manual TokenStream construction to ensure proper spacing. Tests `peek2` for lookahead beyond immediate token.

- `test_peek_not_lifetime` (L62-83): Tests that separated punctuation doesn't form lifetime tokens (`' static` vs `'static`). Demonstrates how spacing affects token interpretation.

- `test_peek_ident` (L85-104): Tests identifier peeking with keyword vs non-keyword distinction. Uses `Ident::peek_any` for any identifier vs `Ident` for non-keywords only.

- `test_peek_groups` (L106-187): Complex test for grouped tokens and multi-level lookahead. Tests parenthesized groups, invisible delimiter groups, and peek operations up to `peek3`. Demonstrates `fork()` for non-consuming parsing and `parse_any_delimiter()` for explicit group handling.

**Dependencies**:
- proc_macro2: Token construction and manipulation
- quote: Token stream generation from Rust syntax
- syn: Parsing infrastructure, tokens, and parse stream operations

**Key Patterns**:
- All tests use nested `assert` functions that take `ParseStream` and return `Result<()>`
- Tests call `assert.parse2(tokens).unwrap()` to execute parsing logic
- Manual TokenStream construction for precise spacing control (lifetime tests)
- Fork pattern for non-destructive lookahead testing
- Progressive token consumption with peek verification at each step

**Critical Invariants**:
- Peek operations are non-consuming - stream state unchanged after peek
- Joint vs alone spacing affects token recognition (especially lifetimes)
- Lookahead numbers (`peek`, `peek2`, `peek3`) correspond to token positions
- Group delimiters create parsing boundaries that affect peek scope