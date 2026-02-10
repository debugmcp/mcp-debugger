# scripts/experiments/
@generated: 2026-02-09T18:16:03Z

## Purpose
Experimental testing environment for JavaScript Debug Adapter Protocol (DAP) development and stabilization. This directory contains controlled test scenarios for validating debugger attachment, breakpoint functionality, and process lifecycle management during standalone debugging operations.

## Key Components
- **probe-target.js**: Primary test target providing a controlled debugging environment with predictable execution patterns, forced breakpoints, and keep-alive mechanisms

## Public API Surface
### Test Entry Points
- **Debugger attachment target**: `probe-target.js` serves as the main executable for testing DAP implementations
- **Breakpoint testing**: Line 6 (`probeVar = 123`) provides reliable breakpoint placement target
- **Expression evaluation**: `add(a, b)` function enables step-through debugging and expression testing

### Usage Pattern
```bash
node probe-target.js  # Provides 500ms+ window for debugger attachment
# Suggested breakpoint: --line 6
```

## Internal Organization
The directory follows a minimalist approach focused on debugging reliability:

1. **Controlled Execution Flow**: Delayed function calls provide predictable timing for debugger attachment
2. **Process Persistence**: Keep-alive mechanisms ensure sufficient time for debug operations
3. **Multiple Breakpoint Strategies**: Combines forced debugger stops with manual breakpoint targets

## Data Flow
Linear execution with timing controls:
`Process Start → Debugger Statement → Variable Assignment → Delayed Function Call → Keep-Alive Loop`

## Important Patterns
- **Timing-based testing**: Uses `setTimeout`/`setInterval` to create predictable debugging windows
- **Minimal complexity**: Prioritizes debugger reliability over functional sophistication
- **Multi-modal breakpoint support**: Accommodates both automatic (`debugger;`) and manual breakpoint placement strategies

This experimental directory serves as a foundation for DAP implementation testing, providing stable targets for debugging protocol validation and development.