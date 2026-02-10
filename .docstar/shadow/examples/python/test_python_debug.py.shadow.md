# examples/python/test_python_debug.py
@source-hash: f22b7b123c339071
@generated: 2026-02-09T18:14:54Z

## Purpose
Test script for Python debugging, providing a collection of simple mathematical and data processing functions with clear execution flow for debugging practice.

## Key Functions

**factorial(n) (L4-8)**
- Recursive factorial implementation
- Base case: n <= 1 returns 1
- No input validation for negative numbers

**sum_list(numbers) (L10-15)**
- Iterative summation of numeric list
- Manual implementation rather than using built-in sum()
- Returns total as accumulated value

**process_data(data) (L17-23)**
- Transforms input list by doubling each element
- Returns new list with processed values
- Simple map-like operation without using map()

**main() (L25-49)**
- Orchestrates testing of all functions
- Demonstrates variable assignments and arithmetic operations
- Prints intermediate results for debugging visibility
- Returns final computed value (z * fact_result)

## Execution Flow
1. Variable initialization (x=10, y=20, z=30)
2. Factorial calculation for input 5 (result: 120)
3. List summation for [1,2,3,4,5] (result: 15)
4. Data processing for [10,20,30] (result: [20,40,60])
5. Final computation: 30 * 120 = 3600

## Architecture
- Simple procedural design with standalone functions
- No external dependencies beyond built-in Python
- Clear separation of concerns with each function handling single responsibility
- Entry point follows standard Python convention with `if __name__ == "__main__"`

## Debug Features
- Multiple print statements for intermediate value inspection
- Simple control flow suitable for step-through debugging
- Predictable input/output relationships for verification