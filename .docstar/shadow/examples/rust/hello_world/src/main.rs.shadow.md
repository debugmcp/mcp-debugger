# examples/rust/hello_world/src/main.rs
@source-hash: 55d7e2fa9b5f2ac5
@generated: 2026-02-10T00:41:04Z

## Purpose
Simple Rust hello world program designed as a debugging demonstration example. Showcases basic Rust syntax, variable types, and control flow structures with debugging-friendly features.

## Key Functions
- **main()** (L9-38): Entry point demonstrating core Rust concepts including variable declarations, function calls, collections, string formatting, conditionals, and loops
- **calculate_sum(a: i32, b: i32) -> i32** (L40-44): Simple arithmetic function taking two integers and returning their sum, designed for breakpoint testing

## Program Flow
1. Prints greeting message (L10)
2. Declares variables of different types: string slice, float, boolean (L13-15)
3. Calls calculation function and displays result (L18-19)
4. Demonstrates mutable vector operations (L22-23)
5. Shows string formatting and interpolation (L26-27)
6. Executes conditional logic based on boolean flag (L30-32)
7. Performs counted loop with iteration display (L35-37)

## Variable Types Demonstrated
- String slices (`&str`) for immutable text
- Floating point (`f64`) for decimal numbers
- Booleans for conditional logic
- Mutable vectors (`Vec<i32>`) for dynamic collections
- Owned strings (`String`) from formatting operations

## Debugging Features
- Multiple variable types for inspection testing
- Function parameters for breakpoint analysis
- Loop constructs for stepping practice
- Collection mutations for memory observation
- Strategic print statements for output verification

## Dependencies
- Standard library only (println! macro, vec! macro, format! macro)
- No external crates required