# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/syn-2.0.110/src/fixup.rs
@source-hash: 7647cde30efdce96
@generated: 2026-02-09T18:12:04Z

## Purpose
Expression fixup and precedence handling module for the `syn` crate. Manages parenthesization rules to ensure expressions can be correctly parsed back after pretty-printing, handling complex precedence and context-dependent parsing scenarios.

## Core Structure

**FixupContext (L11-149)** - Central configuration struct that tracks parsing context and operator precedence relationships. Contains multiple boolean flags and precedence values that determine when parentheses are needed:

- `previous_operator`/`next_operator` (L13,15) - Track surrounding operator precedence
- `stmt` (L28) - Whether expression is in statement position  
- `leftmost_subexpression_in_stmt` (L60) - Handles cases like `(match x {}) - 1;` vs `let _ = match x {} - 1;`
- `match_arm` (L76) - Expression is right-hand side of match arm
- `condition` (L103) - Expression is condition in if/while/match
- `rightmost_subexpression_in_condition` (L112) - Special handling for break/return in conditions
- `next_operator_can_begin_expr`/`next_operator_can_continue_expr` (L130,139) - Control flow expression handling
- `next_operator_can_begin_generics` (L148) - Handles cast vs generic ambiguity like `x as u8 < T`

## Key Methods

**FixupContext::NONE (L154-178)** - Default minimal fixup configuration with all flags disabled

**Constructor methods:**
- `new_stmt()` (L183-188) - Initialize for statement position
- `new_match_arm()` (L193-198) - Initialize for match arm position  
- `new_condition()` (L205-211) - Initialize for conditional expressions

**Context transformation methods:**
- `leftmost_subexpression_with_operator()` (L224-254) - Transforms fixup for leftmost subexpressions, propagates statement/match-arm context
- `leftmost_subexpression_with_dot()` (L260-283) - Special handling for dot/question mark operators
- `rightmost_subexpression()` (L309-323) - Transforms fixup for rightmost subexpressions
- `rightmost_subexpression_fixup()` (L325-348) - Helper for rightmost transformations

**Decision methods:**
- `parenthesize()` (L377-399) - Main decision function determining if parentheses are needed based on context flags
- `precedence()` (L403-443) - Calculates effective precedence considering context
- `leftmost_subexpression_precedence()` (L285-296) - Precedence for leftmost subexpressions with scanning
- `rightmost_subexpression_precedence()` (L350-372) - Precedence for rightmost subexpressions with scanning

## Scanning System

**Scan enum (L455-459)** - Three-state result: Fail/Bailout/Consume for parsing lookahead

**scan_left() (L479-490)** - Determines if left context allows current expression precedence

**scan_right() (L493-773)** - Complex recursive scanner that examines right context to determine precedence conflicts. Handles special cases for:
- Assignment expressions (L513-538)
- Binary operations (L539-578) 
- Unary/reference/raw address expressions (L579-614)
- Range expressions (L615-652)
- Break/return/yield expressions (L653-685)
- Closures (L686-702)
- Let expressions (L703-733)
- All other expression types (L734-772)

## Dependencies
- `crate::classify` - Expression classification utilities
- `crate::expr::Expr` and various expression types - AST node definitions
- `crate::precedence::Precedence` - Operator precedence definitions  
- `crate::ty::ReturnType` - Function return type handling

## Architecture Notes
- Heavily feature-gated with `#[cfg(feature = "full")]` - most functionality only available with full syn features
- Uses precedence-based algorithm with context-sensitive scanning
- Implements Copy/Clone for performance (L446-452, L462-469)
- Complex state machine approach to handle Rust's nuanced parsing rules
- Designed to ensure round-trip fidelity: parse → pretty-print → parse yields same AST