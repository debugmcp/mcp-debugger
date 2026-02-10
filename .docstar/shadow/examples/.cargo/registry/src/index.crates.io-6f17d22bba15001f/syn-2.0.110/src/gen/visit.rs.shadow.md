# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/syn-2.0.110/src/gen/visit.rs
@source-hash: fe1443aa7953eaca
@generated: 2026-02-09T18:06:33Z

**Purpose**: Generated visitor pattern implementation for the syn crate's AST traversal. This file provides immutable traversal of Rust syntax trees through the `Visit` trait and standalone visitor functions.

**Primary Architecture**: 
- `Visit` trait (L28-945): Core trait defining visitor methods for every AST node type in syn
- Standalone visitor functions (L948-3941): Concrete implementations that perform the actual traversal
- Feature-gated compilation: Different visitor methods available based on `"derive"` and `"full"` feature flags
- Macro-driven conditional compilation using `full!` (L9-19) and `skip!` (L20-22) macros

**Key Components**:

**Visit Trait (L28-945)**:
- Lifetime-parameterized trait `Visit<'ast>` for shared borrowing traversal
- ~300+ visitor methods covering all syn AST node types
- Each method delegates to corresponding standalone function by default
- Methods conditionally compiled based on feature flags
- Examples: `visit_expr` (L134), `visit_item` (L457), `visit_type` (L797)

**Standalone Functions (L948-3941)**:
- Pattern-matched traversal implementations for each AST node
- Recursive descent through child nodes using visitor methods
- Token skipping via `skip!` macro for non-semantic elements
- Feature-conditional logic using `full!` macro
- Key examples:
  - `visit_expr` (L1306-1432): Handles all expression variants
  - `visit_item` (L2377-2431): Traverses top-level items
  - `visit_type` (L3516-3567): Processes type annotations

**Conditional Compilation Strategy**:
- `full!` macro (L9-19): Executes code only when "full" feature enabled, otherwise `unreachable!()`
- Feature gates throughout using `#[cfg(any(feature = "derive", feature = "full"))]`
- Granular feature control for different syntax elements

**Visitor Pattern Implementation**:
- Immutable traversal maintaining `&'ast` references
- Depth-first traversal of syntax trees
- Punctuated collections handled via iterator pattern
- Token elements skipped to focus on semantic structure
- Extensible design allowing custom visitor implementations

**Dependencies**:
- `crate::punctuated::Punctuated` (L7): For comma-separated syntax elements
- `proc_macro2::{Ident, Span, TokenStream}`: Core token types
- All `crate::*` AST node types from syn

**Notable Patterns**:
- Generated code marker (L1-2): Indicates automated generation
- Consistent naming: `visit_*` methods mirror AST type names
- Defensive programming: Uses `skip!` for non-traversable elements
- Performance consideration: Empty implementations for terminal nodes like `visit_span` (L3340-3343)