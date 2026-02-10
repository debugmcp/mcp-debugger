# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/syn-2.0.110/tests/debug/gen.rs
@source-hash: cdd89f1bf91fe215
@generated: 2026-02-09T18:06:37Z

## Auto-Generated Debug Trait Implementations for syn AST Types

This file is **auto-generated** by syn-internal-codegen and contains Debug trait implementations for syn's Abstract Syntax Tree (AST) types using the `Lite` wrapper pattern.

### Core Purpose
Provides lightweight, semantically-aware Debug formatting for syn AST nodes that:
- Uses `Lite<T>` wrapper to enable custom Debug implementations
- Omits empty collections and default values for cleaner output
- Formats optional fields with "Some(...)" notation
- Uses `Present` marker for token presence indicators
- Handles verbatim token streams with display formatting

### Key Patterns

**Lite Wrapper Pattern (L6-8)**
- Imports `Lite` and `Present` from parent module
- Uses `ref_cast::RefCast` for zero-cost type conversions
- Enables custom Debug formatting without orphan rule conflicts

**Struct Field Formatting**
Most implementations follow this pattern:
1. Create debug_struct with type name
2. Conditionally include non-empty collections (`!field.is_empty()`)
3. Conditionally include present tokens (`field.is_some()`)
4. Use `Present` marker for token existence
5. Wrap optional complex fields in RefCast Print structs

**Expression Variants (L455-1069)**
Large match expression handling all syn::Expr variants with consistent formatting for:
- Attributes (when non-empty)
- Required fields (always shown)
- Optional fields (with Some(...) wrapper)
- Token presence indicators

**Item Variants (L2263-2559)**
Comprehensive coverage of all syn::Item variants including:
- Const, Enum, ExternCrate, Fn, ForeignMod, Impl, Macro, Mod
- Static, Struct, Trait, TraitAlias, Type, Union, Use
- Verbatim fallback for unparsed content

**Token Implementations (L4740-5239)**
Simple token Debug impls that output standard token syntax (e.g., `Token![pub]`, `Token![->]`)

### Architecture Decisions

**RefCast Print Pattern**
For complex optional fields, uses inner Print structs with RefCast to avoid cloning:
```rust
#[derive(RefCast)]
#[repr(transparent)]
struct Print(FieldType);
```

**Conditional Field Display**
- Empty collections: `if !self.value.field.is_empty()`
- Present tokens: `if self.value.token.is_some()`
- Default enums: `match field { Default => {}, _ => show }`

**Verbatim Handling**
Unparsed token streams formatted as: `Type::Verbatim(\`tokens\`)`

### Notable Types
- **Expr variants**: Comprehensive expression AST coverage (L455+)
- **Item variants**: Top-level item definitions (L2263+)
- **Pattern variants**: Pattern matching constructs (L3119+)
- **Type variants**: Type system representations (L4098+)
- **Token types**: Keyword and operator tokens (L4740+)

This provides a clean, readable debug representation of syn AST structures optimized for developer inspection and debugging workflows.