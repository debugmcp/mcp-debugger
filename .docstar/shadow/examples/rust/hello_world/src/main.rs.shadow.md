# examples/rust/hello_world/src/main.rs
@source-hash: 55d7e2fa9b5f2ac5
@generated: 2026-02-09T18:13:50Z

## Purpose
Educational Rust example demonstrating basic debugging scenarios with variable inspection, stepping, and breakpoint placement for MCP Debugger testing.

## Key Functions
- **main()** (L9-38): Primary entry point showcasing various debugging scenarios including variable declaration, function calls, collections, string formatting, conditionals, and loops
- **calculate_sum(a: i32, b: i32) -> i32** (L40-44): Simple addition function designed for parameter inspection and breakpoint testing

## Code Structure & Debugging Features
- **Variable inspection targets** (L13-15): Basic types (string, float, boolean) for debugger variable viewing
- **Function call debugging** (L18): Invokes calculate_sum for step-into/over scenarios  
- **Collection manipulation** (L22-23): Mutable vector operations for memory/collection inspection
- **String formatting** (L26): Demonstrates complex variable interpolation
- **Control flow** (L30-32): Conditional logic for step-through debugging
- **Loop iteration** (L35-37): Range-based loop for stepping and iteration inspection

## Dependencies
- Standard library only: `println!`, `vec!`, `format!` macros
- No external crates

## Debugging Patterns
The code is intentionally structured with clear breakpoint opportunities at L18 (function call), L41 (parameter inspection), and throughout the loop (L35-37). Each section introduces different variable types and operations to exercise debugger capabilities comprehensively.