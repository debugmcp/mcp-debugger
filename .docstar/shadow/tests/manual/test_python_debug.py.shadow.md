# tests/manual/test_python_debug.py
@source-hash: 249566c2b6a7973c
@generated: 2026-02-09T18:15:06Z

**Primary Purpose**: Manual test script for Python debugging functionality, providing simple arithmetic operations with clear execution flow for debugging practice.

**Key Functions**:
- `calculate_sum(a, b)` (L4-7): Basic addition function that takes two numeric parameters and returns their sum
- `calculate_product(numbers)` (L9-14): Iterative multiplication function that calculates the product of all numbers in a list using a for loop
- `main()` (L16-30): Main execution function that demonstrates both arithmetic operations with hardcoded test values and prints results

**Execution Flow**:
- Entry point at L32-33 uses standard `if __name__ == "__main__"` pattern
- Main function tests addition with values 10 and 20 (L18-21)
- Tests multiplication with list [2, 3, 4] resulting in 24 (L24-26)
- Outputs formatted results using f-strings and concludes with completion message (L29-30)

**Architecture Notes**:
- Simple procedural design with no dependencies beyond built-in functions
- Functions are pure (no side effects except printing)
- Clear separation between computation and I/O operations
- Designed for step-through debugging with meaningful intermediate variables

**Test Data**:
- Addition test: 10 + 20 = 30
- Product test: 2 × 3 × 4 = 24