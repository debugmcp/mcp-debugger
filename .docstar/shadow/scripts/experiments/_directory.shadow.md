# scripts/experiments/
@generated: 2026-02-10T01:19:33Z

## Purpose
This directory contains experimental testing utilities for debugging protocol validation and tooling development. Currently focused on DAP (Debug Adapter Protocol) behavior verification through controlled test scenarios.

## Key Components

**Test Targets:**
- `probe-target.js` - Primary debugging test harness providing reliable breakpoints and execution flow for debugger attachment testing

## Public API Surface

**Entry Points:**
- `probe-target.js` - Main test script designed to be run with debugger tools, typically with `--line 13` parameter for targeted breakpoint testing

**Key Testing Features:**
- Forced breakpoints via `debugger` statement
- Predictable execution timing (500ms delay patterns)
- Process lifecycle management for debugger attachment scenarios
- Simple arithmetic functions for step-through validation

## Internal Organization

The directory follows an experimental structure where each script is a self-contained test scenario:
- Minimal dependencies (Node.js runtime only)
- Explicit timing controls for reliable debugger interaction
- Process management to support various debugger adoption patterns

## Data Flow & Patterns

**Execution Pattern:**
1. Immediate execution with console logging
2. Forced breakpoint via `debugger` statement
3. Timed delay allowing debugger attachment
4. Keep-alive mechanism preventing process termination
5. Continuous availability for external debugger tools

**Design Conventions:**
- Test harness optimization for debugger stability
- Predictable timing and execution flow
- Explicit process lifecycle management
- Minimal external dependencies for reliable reproduction

## Usage Context
Scripts in this directory are designed to be executed by debugging tools and protocol validators rather than as part of normal application flow. They provide controlled environments for testing debugger behavior, attachment mechanisms, and protocol compliance.