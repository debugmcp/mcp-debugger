# examples/python/test_python_debug.py
@source-hash: f22b7b123c339071
@generated: 2026-02-10T00:41:40Z

## Purpose
Test script designed for Python debugging exercises, containing simple mathematical operations and data processing functions to demonstrate debugging workflows and breakpoint placement.

## Key Functions

### `factorial(n)` (L4-8)
Recursive factorial implementation with base case at n≤1. Classic recursion example suitable for step-through debugging to observe call stack behavior.

### `sum_list(numbers)` (L10-15) 
Iterative summation of numeric list using accumulator pattern. Simple loop structure ideal for variable inspection during debugging sessions.

### `process_data(data)` (L17-23)
Maps input list by doubling each element. Demonstrates basic list comprehension alternative using explicit loop and append operations.

### `main()` (L25-49)
Primary execution orchestrator that:
- Sets up test variables (x=10, y=20, z=30) (L26-29)
- Executes factorial(5) and prints result (L31-33)
- Tests sum_list with [1,2,3,4,5] (L35-38)  
- Processes [10,20,30] through doubling operation (L40-43)
- Computes final result as z * factorial_result (L45-47)
- Returns computed final value (L49)

## Execution Flow
Script entry point (L51-53) calls main() and prints the returned result. Designed as self-contained demonstration with predictable outputs for debugging validation.

## Dependencies
No external dependencies - uses only Python built-ins (print, basic arithmetic, list operations).

## Architecture Notes
Simple procedural design with clear separation of mathematical operations. Each function performs single responsibility, making it ideal for isolated debugging scenarios. Variable naming and structure optimized for educational debugging rather than production efficiency.