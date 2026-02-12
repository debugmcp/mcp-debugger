# scripts\experiments/
@generated: 2026-02-12T21:05:37Z

## Purpose
The `scripts/experiments` directory contains experimental testing utilities for debugging and development workflows. This module serves as a controlled environment for validating debugger behavior, protocol compliance, and attachment scenarios.

## Key Components
**Test Targets:**
- `probe-target.js` - Primary debugging test harness providing reliable breakpoint targets and process lifecycle management for DAP (Debug Adapter Protocol) validation

## Public API Surface
**Entry Points:**
- `probe-target.js` - Executable test script designed to run with `--line 13` parameter for targeted debugging sessions

**Key Testing Features:**
- Forced breakpoint via `debugger` statement
- Predictable breakpoint target (`probeVar` on line 13)
- Process keep-alive functionality for debugger attachment
- Simple arithmetic function for step-through testing

## Internal Organization & Data Flow
The module follows a minimal test harness pattern:
1. **Initialization** - Sets up debugging hooks and logging markers
2. **Delayed Execution** - 500ms timeout window allows debugger attachment
3. **Keep-Alive Loop** - Infinite interval prevents process termination for adoption scenarios

## Important Patterns & Conventions
- **Debugger-First Design** - All components optimized for external debugger tool compatibility
- **Predictable Timing** - Fixed delays ensure consistent test conditions
- **Process Lifecycle Management** - Explicit control over process termination for reliable debugging sessions
- **Minimal Dependencies** - Pure Node.js runtime requirements for maximum compatibility

## Usage Context
This experimental module is primarily used for:
- DAP behavior validation and testing
- Debugger attachment scenario verification  
- Development tool integration testing
- Protocol compliance validation

The directory represents a controlled testing environment separate from production code, allowing safe experimentation with debugging workflows and tooling.