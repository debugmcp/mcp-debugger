# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/syn-2.0.110/src/buffer.rs
@source-hash: 7622b646e0d23990
@generated: 2026-02-09T18:11:59Z

A token buffer implementation providing efficient, multi-traversal access to token streams via cheaply copyable cursors. Core component of Syn's parsing infrastructure with careful unsafe code for performance.

## Core Types

**Entry (L18-28)**: Internal representation of token tree elements within the buffer. Enum variants mirror TokenTree types:
- `Group(Group, usize)`: Group with offset to matching End entry
- `Ident(Ident)`, `Punct(Punct)`, `Literal(Literal)`: Simple token types
- `End(isize, isize)`: Buffer terminator with negative offsets to buffer start and matching Group

**TokenBuffer (L33-37)**: Immutable buffer containing linearized token tree as boxed slice. Not cloneable by design to prevent accidental expensive operations. Key methods:
- `new()/new2()` (L66-79): Construct from TokenStream using recursive flattening
- `begin()` (L83-86): Create cursor to first token

**Cursor<'a> (L97-106)**: Lightweight, copyable pointer into TokenBuffer with lifetime safety. Contains:
- `ptr`: Current position in buffer
- `scope`: Boundary marker for traversal limits  
- `marker`: PhantomData for lifetime variance

## Key Algorithms

**Buffer Construction (L40-60)**: `recursive_new()` flattens TokenStream into linear array with forward/backward offset tracking for nested groups. Groups store offset to their End marker; End entries store offsets back to buffer start and matching Group.

**Cursor Navigation (L132-149)**: `create()` method intelligently skips over End entries except at scope boundaries, enabling transparent handling of None-delimited groups.

**None-Delimiter Transparency (L171-179)**: `ignore_none()` automatically traverses through invisible grouping delimiters, critical for macro expansion handling.

## Public Interface Methods

**Token Extraction**:
- `ident()` (L190-196), `punct()` (L200-208), `literal()` (L212-218): Extract specific token types
- `lifetime()` (L222-236): Composite parsing of `'` + identifier
- `group()/any_group()` (L240-274): Group traversal with delimiter filtering
- `token_tree()` (L305-316): Generic token extraction

**Traversal**:
- `eof()` (L183-186): End-of-scope detection
- `skip()` (L351-370): Efficient advancement without token cloning
- `token_stream()` (L288-296): Collect remaining tokens

**Metadata**:
- `span()` (L320-335): Current token span with special End handling
- `scope_delimiter()` (L372-380): Determine containing group type

## Safety Invariants

- All raw pointer operations gated by unsafe blocks with detailed comments
- Cursor pointers guaranteed valid through PhantomData lifetime constraint
- Buffer immutability ensures pointer stability
- Scope boundaries prevent buffer overruns

## Dependencies

- `proc_macro2`: Core token types and spans
- `crate::Lifetime`: Custom lifetime token representation
- Standard library: Pointer operations, ordering, phantom types

## Architecture Notes

Linear buffer design enables O(1) cursor copying and efficient multi-pass parsing. Offset-based group tracking avoids recursive data structures while maintaining tree relationships. None-delimiter transparency crucial for macro hygiene in Rust parsing.