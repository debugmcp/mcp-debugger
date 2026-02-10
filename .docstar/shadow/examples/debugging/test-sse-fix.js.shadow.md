# examples/debugging/test-sse-fix.js
@source-hash: a69826185c4e17f3
@generated: 2026-02-10T00:41:34Z

## Primary Purpose
Simple debugging test script designed for setting breakpoints and testing basic arithmetic operations. Serves as a minimal example for debugging workflows.

## Key Functions
- **testFunction()** (L2-8): Core test function that performs basic arithmetic (10 + 20) and logs results. Contains explicit breakpoint instruction at line 5 for debugging purposes.

## Execution Flow
- Function definition and immediate execution pattern (L2-8, L11)
- Dual console output: internal function logging (L6) and external result verification (L12)
- Return value propagation from function to caller (L7, L11)

## Architecture Notes
- No dependencies or imports - standalone script
- Synchronous execution model
- Hard-coded test values for predictable debugging behavior
- Comment-guided breakpoint placement for debugging tools

## Key Variables
- Local constants `x`, `y` (L3-4): Test operands
- `result` (L5): Computation result and return value
- `output` (L11): Function return value capture