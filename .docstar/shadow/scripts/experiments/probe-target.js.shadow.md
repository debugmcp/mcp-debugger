# scripts/experiments/probe-target.js
@source-hash: 64aee27d53065bbe
@generated: 2026-02-09T18:14:57Z

## Purpose
Test target file for stabilizing JavaScript Debug Adapter Protocol (DAP) behavior during standalone debugging probe experiments. Provides controlled environment for testing debugger attachment and breakpoint functionality.

## Key Components

### Debugging Entry Points
- **Forced debugger stop (L11)**: `debugger;` statement ensures immediate breakpoint regardless of external breakpoint configuration
- **Breakpoint target variable (L13)**: `probeVar = 123` serves as suggested line for manual breakpoint placement (referenced as `--line 6` in usage comments)

### Test Functions
- **add function (L15-17)**: Simple arithmetic function `add(a, b)` used to verify debugger can step through and evaluate expressions

### Process Lifecycle Management
- **Delayed execution (L19-21)**: `setTimeout` with 500ms delay calls test function and logs result
- **Keep-alive mechanism (L24)**: `setInterval` with empty callback every 1000ms prevents process termination, ensuring debugger has sufficient time for attach/adoption operations

## Dependencies
- Node.js runtime (uses `console.log`, `setTimeout`, `setInterval`)
- JavaScript debugger/DAP implementation for attachment

## Architectural Pattern
Simple linear execution with controlled timing designed specifically for debugger testing scenarios. The file prioritizes debugger reliability over functional complexity, using minimal code to test maximum debug adapter functionality.