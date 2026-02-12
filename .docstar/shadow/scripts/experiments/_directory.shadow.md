# scripts\experiments/
@generated: 2026-02-12T21:00:50Z

## Purpose
The `scripts/experiments` directory contains experimental debugging and testing utilities designed to validate and test Debug Adapter Protocol (DAP) behavior. This module serves as a controlled testing environment for debugging tools and debugger attachment scenarios.

## Key Components
The directory currently contains:

**probe-target.js** - A minimal test harness script that provides:
- Reliable debugging breakpoints and hooks
- Process lifecycle management for debugger attachment
- Simple execution flow for step-through debugging tests

## Public API Surface
**Entry Points:**
- `probe-target.js` - Primary test target for debugging validation
  - Intended usage: `node probe-target.js --line 13`
  - Provides predictable breakpoint at line 13 (`probeVar` constant)
  - Includes `debugger` statement for forced breakpoints

**Key Testing Functions:**
- `add(a, b)` - Simple arithmetic function for step-through testing
- Built-in timing controls (500ms delay, keep-alive interval)

## Internal Organization & Data Flow
The experimental scripts follow a minimal test harness pattern:

1. **Initialization Phase** - Console logging and debugger hooks setup
2. **Execution Phase** - Delayed computation with predictable timing (500ms)
3. **Persistence Phase** - Keep-alive interval to maintain process for debugger adoption

## Important Patterns & Conventions
- **Debugger-First Design**: Scripts are optimized for debugging tool validation rather than production use
- **Process Lifecycle Management**: Explicit control over process termination to support external debugger attachment
- **Predictable Execution**: Fixed timing and sequential flow for reliable test scenarios
- **Zero Dependencies**: Pure Node.js runtime usage for maximum compatibility

## Use Cases
- DAP behavior validation and testing
- Debugger attachment and adoption scenario testing
- Step-through debugging verification
- Breakpoint reliability testing

This directory serves as a sandbox for debugging tool development and validation, providing controlled, predictable test scenarios for debugging infrastructure.