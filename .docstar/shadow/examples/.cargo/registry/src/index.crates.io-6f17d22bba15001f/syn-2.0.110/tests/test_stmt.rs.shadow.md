# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/syn-2.0.110/tests/test_stmt.rs
@source-hash: b3c120059d7b5638
@generated: 2026-02-09T18:12:09Z

## Test Suite for Rust Statement Parsing

Test file for the `syn` crate's statement (`Stmt`) parsing functionality. Contains comprehensive tests for various edge cases and language constructs in Rust statement parsing.

**Module Dependencies:**
- `snapshot` macro module (L10) for test result validation
- `debug` module (L12) for debugging utilities
- Core dependencies: `proc_macro2`, `quote`, `syn` (L14-17)

**Key Test Functions:**

### Raw Pointer Tests (L19-71)
- `test_raw_operator` (L19-42): Tests parsing of `&raw const` expressions
- `test_raw_variable` (L44-66): Tests parsing of `&raw` as a variable reference (not operator)
- `test_raw_invalid` (L68-71): Validates that malformed raw pointer syntax fails parsing

### Token Group Handling (L73-126)
- `test_none_group` (L73-126): Tests parsing statements wrapped in invisible delimiter groups
  - Tests async function parsing within None-delimited groups (L76-99)
  - Tests let expressions within None-delimited groups (L101-125)

### Pattern Matching Tests (L128-195)
- `test_let_dot_dot` (L128-144): Tests rest pattern (`..`) in let statements
- `test_let_else` (L146-195): Tests let-else syntax with diverging blocks

### Macro Parsing Tests (L197-279)
- `test_macros` (L197-279): Comprehensive test for various macro forms:
  - `macro_rules!` declarations as items
  - Statement macros with semicolons (`thread_local!`, `println!`)
  - Expression macros without semicolons (`vec!`)

### Control Flow Parsing (L281-337)
- `test_early_parse_loop` (L281-337): Tests disambiguation between loop expressions and function calls
  - Tests unlabeled loops (L285-307)
  - Tests labeled loops with lifetime labels (L309-336)

**Testing Patterns:**
- Uses `snapshot!` macro for AST structure validation
- Tests both positive cases (successful parsing) and negative cases (expected failures)
- Focuses on edge cases where parsing ambiguity might occur
- Tests manual token stream construction vs. `quote!` macro generation

**Key Parsing Scenarios:**
- Raw pointer disambiguation from variable references
- Invisible token group handling in various contexts  
- Pattern syntax variations in let statements
- Macro syntax variations (item vs statement vs expression)
- Control flow expression parsing precedence