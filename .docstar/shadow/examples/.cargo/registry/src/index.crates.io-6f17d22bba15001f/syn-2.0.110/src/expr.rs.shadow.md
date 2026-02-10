# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/syn-2.0.110/src/expr.rs
@source-hash: fa766ce749ea3136
@generated: 2026-02-09T18:12:30Z

## Primary Purpose

Core expression AST definitions for Rust syntax tree parsing and code generation in the syn crate. Provides comprehensive representation of all Rust expression types with feature-gated parsing and printing capabilities.

## Key Structures and Enums

### Main Expression Enum
- **Expr (L35-267)**: Primary enum representing all Rust expression types
  - 47 expression variants from Array to Yield
  - Feature-gated: most variants require "full" feature, basic ones need "derive"
  - Non-exhaustive enum with extensibility pattern
  - Includes PLACEHOLDER constant (L736-743) for temporary replacement during tree manipulation

### Expression Variant Structs
- **ExprBinary (L312-321)**: Binary operations with left/right operands and operator
- **ExprCall (L345-354)**: Function calls with func and args
- **ExprMethodCall (L534-546)**: Method calls with receiver, method name, optional turbofish, args
- **ExprField (L405-415)**: Field access with base expression and member
- **ExprPath (L558-569)**: Path expressions with optional qualified self
- **ExprStruct (L627-642)**: Struct literals with fields and optional base expression

### Utility Types
- **Member (L971-981)**: Named (Ident) or Unnamed (Index) struct field access
- **Index (L1049-1056)**: Tuple field index with span information
- **FieldValue (L1093-1106)**: Field-value pairs in struct literals with optional colon
- **Label (L1109-1116)**: Lifetime labels for loops (full feature only)
- **Arm (L1118-1146)**: Match arm with pattern, guard, and body (full feature only)

## Feature Architecture

### Feature Gates
- **"derive"**: Basic expressions (Binary, Call, Cast, Field, Index, Lit, Macro, MethodCall, Paren, Path, Reference, Struct, Tuple, Unary)
- **"full"**: Complete expression set including control flow, closures, loops, async
- **"parsing"**: Parse implementations and parsing utilities
- **"printing"**: ToTokens implementations for code generation

### Module Organization
- **parsing (L1171-3118)**: Parser implementations with precedence handling and structural disambiguation
- **printing (L3120-4173)**: Pretty-printer with precedence-aware parenthesization

## Key Methods and Functions

### Expression Utilities
- **Expr::parse_without_eager_brace (L826-830)**: Avoids struct literal ambiguity in conditions
- **Expr::parse_with_earlier_boundary_rule (L888-892)**: Handles expression boundaries in match arms/statements  
- **Expr::peek (L905-922)**: Lookahead for expression start tokens
- **replace_attrs (L924-969)**: Swaps attribute vectors across all expression variants

### Parsing Infrastructure
- **ambiguous_expr (L483-499)**: Main expression parser entry point
- **unary_expr (L514-562 full, L564-582 derive)**: Parses prefix expressions
- **parse_expr (L1309-1388 full, L1390-1431 derive)**: Precedence climbing with fixup context
- **trailer_helper (L1622-1713)**: Handles postfix operators (calls, field access, indexing)

### Precedence and Fixup
- **print_subexpression (L3163-3191)**: Conditional parenthesization based on precedence
- **FixupContext**: Manages parenthesization requirements for pretty-printing

## Notable Patterns

### Rebinding Idiom
Extensive documentation (L41-109) promotes pattern matching with variable rebinding:
```rust
match expr {
    Expr::MethodCall(expr) => { /* use expr.receiver, expr.args */ }
    Expr::If(expr) => { /* use expr.cond, expr.then_branch */ }
}
```

### Structural Disambiguation
Handles Rust grammar ambiguities:
- Struct literals vs blocks in conditionals (AllowStruct wrapper L1224-1225)
- Range expressions vs binary operators
- Trailing brace parsing in various contexts

### Macro-Generated Code
Heavy use of `ast_struct!` and `ast_enum!` macros for consistent AST node generation with automatic trait implementations.