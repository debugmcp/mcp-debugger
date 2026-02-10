# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/syn-2.0.110/src/gen/fold.rs
@source-hash: 39b0a26cfdf0acca
@generated: 2026-02-09T18:06:33Z

**Generated fold.rs - Syntax Tree Transformation Module**

This is a machine-generated file from syn-internal-codegen that provides a visitor pattern for transforming owned Rust syntax tree nodes. The file implements the **Fold** trait pattern for deep transformation of AST nodes.

**Primary Components:**

- **`full!` macro (L11-21)**: Feature-gated macro that either evaluates its expression (when `full` feature enabled) or panics with `unreachable!()` (when only `derive` feature enabled)

- **`Fold` trait (L27-1025)**: Core trait defining transformation methods for all AST node types. Each method takes a mutable reference to self and an owned node, returning the transformed node. Methods are feature-gated based on `derive`/`full` features and include:
  - Expression folding methods (L141-341): `fold_expr`, `fold_expr_*` variants
  - Type folding methods (L868-956): `fold_type`, `fold_type_*` variants  
  - Item folding methods (L485-571): `fold_item`, `fold_item_*` variants
  - Pattern folding methods (L665-725): `fold_pat`, `fold_pat_*` variants
  - Basic token folding: `fold_ident` (L442), `fold_span` (L795), `fold_token_stream` (L816)

**Implementation Functions (L1028-3902):**

Each `fold_*` function provides default traversal behavior by reconstructing nodes with transformed children:

- **Expression folders** (L1321-1957): Handle all expression variants, using `full!()` macro for full-feature-only expressions
- **Type folders** (L3458-3718): Transform type expressions and their components
- **Item folders** (L2364-2664): Process top-level language constructs like functions, structs, traits
- **Pattern folders** (L2924-3097): Transform pattern matching constructs
- **Utility folders**: Basic token types, punctuation, and structural elements

**Key Architectural Patterns:**

- **Visitor Pattern**: Each node type has a corresponding fold method that recursively transforms child nodes
- **Feature Gating**: Extensive use of `#[cfg()]` attributes to conditionally compile methods based on enabled features
- **Owned Transformation**: Unlike typical visitors, this consumes and returns owned nodes, enabling structural transformation
- **Default Traversal**: Implementation functions provide sensible defaults that preserve structure while allowing selective overriding

**Helper Functions:**

- **`fold_vec` (L3896-3902)**: Transforms vectors of foldable items
- **`fold_ident` (L2234-2242)**: Handles identifier transformation with span folding
- **`fold_span` (L3284-3289)**: Identity transformation for spans (no-op by default)

The module enables deep syntax tree transformations while maintaining type safety and supporting syn's feature-gated architecture for different use cases (derive macros vs full parsing).