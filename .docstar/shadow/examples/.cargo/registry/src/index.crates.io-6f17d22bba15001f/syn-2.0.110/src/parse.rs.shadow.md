# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/syn-2.0.110/src/parse.rs
@source-hash: bbe69237d50ce5f9
@generated: 2026-02-09T18:12:21Z

# parse.rs - Syn Parsing Interface

This file implements Syn's core parsing system for converting token streams into syntax tree nodes. It provides the fundamental parsing abstractions that enable procedural macros to parse Rust syntax.

## Core Traits

**Parse (L214-216)**: Primary trait for types that can be parsed from token streams in a default way. Implemented by all parseable syntax tree nodes in Syn.

**Parser (L1239-1277)**: Higher-level trait for parser functions, providing entry points like `parse2()`, `parse()`, and `parse_str()`. Automatically implemented for closures that take `ParseStream` and return `Result<T>`.

## Key Data Structures

**ParseBuffer (L246-262)**: The core parsing state container that tracks position within a token stream. Contains a `Cursor` wrapped in a `Cell` to enable mutation, along with error tracking state via `Unexpected`. Uses lifetime variance tricks to maintain safety.

**ParseStream (L224)**: Type alias for `&ParseBuffer` - the standard input type for all parser functions in Syn.

**StepCursor (L335-348)**: Specialized cursor for low-level speculative parsing operations. Provides invariant lifetime guarantees to ensure memory safety during step operations.

## Parsing Methods (ParseBuffer impl L462-1163)

**parse() (L465-467)**: Parses any type implementing `Parse` trait
**call() (L505-507)**: Invokes parser functions directly
**peek/peek2/peek3() (L581-641)**: Non-consuming lookahead for different token types
**parse_terminated() (L734-745)**: Parses punctuated sequences with optional trailing punctuation
**is_empty() (L791-793)**: Checks if stream is exhausted
**lookahead1() (L836-838)**: Creates error-aware lookahead helper
**fork() (L966-975)**: Creates independent parsing branch for speculative parsing
**error() (L1005-1007)**: Generates parsing errors at current position
**step() (L1054-1082)**: Low-level cursor manipulation for advanced parsing
**span()/cursor() (L1087-1155)**: Access to underlying token representation

## Built-in Parse Implementations (L1166-1232)

Standard implementations for `Box<T>`, `Option<T>`, `TokenStream`, `TokenTree`, `Group`, `Punct`, and `Literal`.

## Error Handling

**Unexpected enum (L399-418)**: Tracks unexpected token positions for better error reporting
**inner_unexpected()/get_unexpected() (L430-443)**: Error state management utilities
**err_unexpected_token() (L1327-1335)**: Generates context-appropriate error messages

## Utility Types

**Nothing (L1367-1419)**: Empty parser for attribute macros that expect no arguments

## Internal Functions

**new_parse_buffer() (L385-397)**: ParseBuffer constructor
**tokens_to_parse_buffer() (L1279-1284)**: Converts TokenBuffer to ParseBuffer
**parse_scoped() (L1323-1325)**: Internal scoped parsing entry point
**advance_step_cursor() (L376-383)**: Unsafe lifetime casting for step cursors

The file uses extensive lifetime management and `Cell`-based interior mutability to provide a safe, efficient parsing interface while maintaining Rust's borrowing rules. The parsing system is designed around speculative parsing patterns common in recursive descent parsers.