# scripts\experiments/
@children-hash: 531505392cda25a6
@generated: 2026-02-15T09:01:20Z

## Purpose
Experimental testing utilities for debugging and development workflows. This directory contains specialized test targets and probes designed to validate debugger behavior and protocol interactions.

## Key Components

**Debug Target Scripts:**
- `probe-target.js` - Primary test harness for DAP (Debug Adapter Protocol) validation, providing reliable breakpoint targets and process lifecycle management for debugger attachment scenarios

## Public API Surface

**Entry Points:**
- `probe-target.js` - Command-line executable test target, typically invoked with `--line 13` parameter for specific breakpoint testing

**Key Testing Features:**
- Forced breakpoint triggers via `debugger` statements
- Predictable execution timing (500ms delays) for debugger attachment windows  
- Process keep-alive mechanisms for adoption scenarios
- Simple arithmetic functions for step-through debugging validation

## Internal Organization

**Execution Flow:**
1. Immediate debugging hooks and logging markers
2. Timed execution delay allowing debugger attachment
3. Simple computation functions for testing step-through behavior
4. Infinite process preservation for external tool interaction

**Data Flow:**
- Console output provides execution state visibility
- Breakpoint variables (`probeVar`) serve as inspection targets
- Function calls generate stack frames for debugging validation

## Important Patterns & Conventions

**Debugger-First Design:**
- Scripts prioritize debugger stability and predictable behavior over functionality
- Explicit process lifecycle management prevents premature termination
- Minimal dependencies ensure consistent runtime behavior across environments

**Test Harness Architecture:**
- Simple, focused test targets that isolate specific debugging scenarios
- Timing-aware execution that accommodates external tool attachment
- Self-contained validation points that don't require complex setup

This module serves as a controlled testing environment for debugging tool development and validation, providing reliable targets for protocol testing and debugger behavior verification.