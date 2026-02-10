# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/syn-2.0.110/tests/common/eq.rs
@source-hash: 4e66a9bd9262a8ff
@generated: 2026-02-09T18:06:38Z

## Purpose
This file implements the `SpanlessEq` trait for comparing Rust AST nodes while ignoring span information. It's part of syn's testing infrastructure to enable semantic equality comparisons between parsed AST structures without being affected by source location differences.

## Key Components

### SpanlessEq Trait (L190-192)
Core trait defining span-agnostic equality with single method `eq(&self, other: &Self) -> bool`.

### Generic Implementations (L194-283)
- **Box<T>, Arc<T>** (L194-204): Delegate to inner value comparison
- **Option<T>** (L206-214): Handle None/Some variants with inner equality
- **Result<T, E>** (L216-224): Compare Ok/Err variants independently 
- **Collections** (L226-257): Vec, slice, ThinVec, HashMap with element-wise comparison
- **Tuples** (L271-283): Support for 2-tuple and 3-tuple comparison
- **Cow<T>, Spanned<T>** (L259-269): Delegate to underlying type

### Macro-Generated Implementations

#### spanless_eq_true! (L285-293)
Generates implementations that always return true for span-like types:
- Span, DelimSpan, AttrId, NodeId, SyntaxContext, Spacing (L295-300)

#### spanless_eq_partial_eq! (L302-329) 
Delegates to PartialEq for primitive types and simple enums:
- Primitives: bool, u8-u128, char, str, String (L312-321)
- Symbols: Symbol, ByteSymbol (L323-324)
- Token types: CommentKind, Delimiter, InlineAsmOptions (L325-327)

#### spanless_eq_struct! (L331-377)
Complex macro for struct implementations with field selection:
- Supports field inclusion `[field this other]` and exclusion `![field]`
- Generates destructuring pattern matches for comparison
- Used extensively for AST nodes (L478-558)

#### spanless_eq_enum! (L379-476)  
Complex macro for enum implementations:
- Matches variant patterns with field handling
- Supports positional and named fields
- Handles field exclusion with `!` prefix
- Used for all major AST enum types (L559-665)

### Manual Implementations

#### Critical Custom Implementations
- **Ident** (L667-671): Compare string representation, ignore span
- **RangeSyntax** (L673-679): Always true for DotDotDot/DotDotEq variants
- **Param** (L681-707): Special handling for error types in function parameters
- **TokenKind** (L709-720): Custom logic for literal tokens and range operators
- **TokenStream** (L722-755): Complex token-by-token comparison with doc comment handling
- **AttrKind** (L866-892): Bidirectional comparison between DocComment and Normal attributes
- **LazyAttrTokenStream** (L858-864): Converts to AttrTokenStream before comparison
- **FormatArguments** (L894-898): Delegates to all_args() comparison

### Token Stream Processing (L757-856)
- **doc_comment()** (L757-808): Handles doc comment token expansion
- **is_escaped_literal_token()** (L810-821): Validates literal token escaping
- **is_escaped_literal_meta_item_lit()** (L823-833): Meta item literal validation
- **is_escaped_lit()** (L835-847): Direct literal validation
- **is_escaped_lit_kind()** (L849-856): String literal content comparison with carriage return normalization

## Dependencies
- **rustc_ast**: Core AST types and token structures (L9-174)
- **rustc_span**: Span utilities, symbols, identifiers (L181-183) 
- **rustc_data_structures**: Packed integer types (L180)
- **thin_vec**: Memory-efficient vectors (L188)

## Architecture Notes
- Comprehensive coverage of rustc AST through macro generation
- Token stream comparison handles doc comment expansion edge cases
- Special handling for error recovery scenarios in parsing
- Carriage return normalization for cross-platform string comparison