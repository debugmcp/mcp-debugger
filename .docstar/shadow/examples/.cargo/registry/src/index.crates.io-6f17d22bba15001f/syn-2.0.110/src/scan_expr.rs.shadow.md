# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/syn-2.0.110/src/scan_expr.rs
@source-hash: e199c35e8bbf3e2c
@generated: 2026-02-09T18:12:19Z

## Expression Scanner State Machine for Syn Parser

This file implements a deterministic state machine for scanning Rust expressions in the syn parsing library. The scanner validates expression syntax without full parsing by transitioning through predefined states based on token patterns.

### Core Architecture

**Input Enum (L9-26)**: Defines 16 token matching patterns including keywords, punctuation, type expectations, and consumption actions. Key patterns:
- `Keyword`/`Punct`: Match specific tokens
- `Consume*`: Parse and advance over token types (identifiers, literals, delimiters)
- `Expect*`: Parse specific constructs (paths, types, turbofish)
- `CanBeginExpr`/`Otherwise`/`Empty`: Control flow conditions

**Action Enum (L28-33)**: Defines state machine actions:
- `SetState`: Transition to new state table
- `IncDepth`/`DecDepth`: Track nesting level for conditional expressions
- `Finish`: Complete successful scan

### State Tables

Static transition tables define the state machine behavior:

**INIT (L35-64)**: Entry state handling expression beginnings - keywords (async, break, const, etc.), operators, literals, and paths.

**POSTFIX (L66-77)**: Handles postfix operators, method calls, field access, and binary operations after primary expressions.

**Expression-specific states**:
- `ASYNC` (L79-83): Async block/closure parsing
- `CLOSURE*` (L98-116): Closure syntax including args and return types  
- `PATTERN` (L152-168): Pattern matching constructs
- `IF_*` (L139-141): Conditional expression nesting
- `DOT` (L128-132): Method calls and field access

### Main Function

**scan_expr (L196-268)**: Core scanning loop that:
1. Maintains current state and nesting depth
2. Iterates through state rules until match found
3. Executes corresponding action (state transition, depth change, or finish)
4. Returns error if no valid transition exists

The function uses syn's `ParseStream::step` for zero-copy lookahead parsing and handles complex punctuation sequences by character-by-character matching.

### Key Patterns

- **Depth tracking**: Manages nested constructs like if/match expressions
- **Conditional transitions**: `ConsumeNestedBrace` only matches when depth > 0
- **Fallback handling**: `Otherwise` provides default transitions
- **Zero-copy parsing**: Uses cursor-based lookahead for efficiency