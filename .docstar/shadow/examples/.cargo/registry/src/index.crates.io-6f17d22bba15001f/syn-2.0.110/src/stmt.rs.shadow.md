# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/syn-2.0.110/src/stmt.rs
@source-hash: 7a594d08cbedef4c
@generated: 2026-02-09T18:12:04Z

## Primary Purpose
Defines Rust statement AST nodes and provides parsing/printing functionality for the Syn crate. This file models Rust statements including blocks, local bindings, items, expressions, and macro invocations.

## Key AST Structures

### Block (L8-16)
Represents a braced block containing Rust statements (`{ ... }`). Contains:
- `brace_token`: The surrounding braces
- `stmts`: Vector of statements within the block

### Stmt (L18-38)
Core statement enum with four variants:
- `Local`: Local `let` bindings
- `Item`: Item definitions (functions, structs, etc.)
- `Expr`: Expressions with optional trailing semicolon
- `Macro`: Macro invocations in statement position

### Local (L40-50)
Represents `let` bindings with:
- `attrs`: Attributes
- `let_token`: The `let` keyword
- `pat`: Pattern being bound
- `init`: Optional initialization (`LocalInit`)
- `semi_token`: Required semicolon

### LocalInit (L52-64)
Handles `let` binding initialization including `else` divergence blocks:
- `eq_token`: The `=` token
- `expr`: The initializing expression
- `diverge`: Optional `else { ... }` block for refutable patterns

### StmtMacro (L66-78)
Macro invocations in statement context with attributes and optional semicolon.

## Parsing Module (L80-412)

### Key Functions
- `Block::parse_within` (L151-176): Parses statements within braces, handling semicolon requirements
- `parse_stmt` (L198-264): Main statement parsing dispatcher with complex lookahead logic
- `stmt_mac` (L266-281): Parses macro statements
- `stmt_local` (L283-332): Parses `let` statements with type annotations and initialization
- `stmt_expr` (L334-411): Parses expression statements, handling attribute attachment

### Parsing Strategy
Uses extensive lookahead (L204-258) to disambiguate between:
- Items vs expressions
- Macros vs function calls
- Different statement types

The parser handles edge cases like:
- Empty semicolons (L154-156)
- Trailing expressions in blocks
- Macro delimiter handling
- Attribute attachment to sub-expressions (L341-387)

## Printing Module (L414-484)

### ToTokens Implementations
- `Block` (L425-431): Surrounds statements with braces
- `Stmt` (L434-446): Delegates to appropriate variant printer
- `Local` (L449-474): Handles complex `let` syntax including `else` blocks
- `StmtMacro` (L477-483): Prints macro with attributes and semicolon

## Dependencies
- `crate::attr::Attribute`: For attribute handling
- `crate::expr::Expr`: Expression AST nodes
- `crate::item::Item`: Item definitions
- `crate::mac::Macro`: Macro representations
- `crate::pat::Pat`: Pattern matching
- `crate::token`: Token types

## Architectural Notes
- Uses `ast_struct!` and `ast_enum!` macros for AST node generation
- Feature-gated parsing (`#[cfg(feature = "parsing")]`) and printing (`#[cfg(feature = "printing")]`)
- Complex lookahead parsing to handle Rust's ambiguous grammar
- Attribute handling propagated through parsing chain
- Special handling for expression-statements vs statement-macros