# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/syn-2.0.110/src/precedence.rs
@source-hash: 58420a5015003ecd
@generated: 2026-02-09T18:12:16Z

**Primary Purpose:**
Defines Rust expression precedence hierarchy for the syn crate's AST printing functionality. Provides precedence ordering and classification for expressions to determine when parentheses are needed during code generation.

**Key Components:**

- **Precedence enum (L18-54):** Defines operator precedence levels from lowest to highest, following Rust's expression precedence rules. Key variants:
  - `Jump` (L20): return, break, closures - lowest precedence
  - `Assign` (L22): assignment operators (=, +=, etc.)
  - `Range` (L24): range operators (.., ..=)
  - `Or` (L26), `And` (L28): logical operators
  - `Let` (L31): let expressions (printing feature only)
  - `Compare` (L33): comparison operators
  - Bitwise operators: `BitOr` (L35), `BitXor` (L37), `BitAnd` (L39)
  - `Shift` (L41), `Sum` (L43), `Product` (L45): arithmetic operators
  - `Cast` (L47): type casting (as)
  - `Prefix` (L50): unary operators (printing feature only)
  - `Unambiguous` (L53): highest precedence expressions

**Core Methods:**

- **of_binop (L59-88):** Maps BinOp variants to their corresponding precedence levels. Handles all binary operators including arithmetic, logical, comparison, bitwise, and assignment operators.

- **of (L91-187):** Main precedence determination function for expressions (printing feature only). Complex pattern matching that:
  - Handles closures with special logic for return type annotations (L104-107)
  - Processes jump expressions (break, return, yield) with optional values (L110-115)
  - Maps expression types to precedence levels
  - Uses `prefix_attrs` helper (L93-100) to check for outer attributes that affect precedence
  - Includes separate logic paths for "full" vs minimal feature sets

**Trait Implementations:**

- **Copy/Clone (L190-196):** Manual implementations using pointer copy
- **PartialEq (L198-202):** Compares precedence by casting to u8 discriminants
- **PartialOrd (L204-210):** Orders precedence levels by u8 comparison

**Dependencies:**
- `crate::op::BinOp` for binary operators
- Various expression types from `crate::expr` (feature-gated)
- `crate::attr` for attribute handling (feature-gated)
- `std::cmp::Ordering` for comparison operations

**Architecture Notes:**
- Heavily feature-gated with "printing" and "full" features controlling availability
- Enum discriminant ordering defines precedence hierarchy (lower discriminant = lower precedence)
- Design follows Rust language specification for expression precedence
- Supports both minimal and full expression parsing modes