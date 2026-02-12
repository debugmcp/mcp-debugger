# scripts/experiments/
@generated: 2026-02-11T23:47:32Z

## Purpose
Experimental testing infrastructure for debugging and development workflows. This directory contains specialized test harnesses and probes designed to validate Debug Adapter Protocol (DAP) behavior and provide controlled debugging environments.

## Key Components

**Test Targets:**
- `probe-target.js` - Primary debugging test harness providing reliable breakpoint targets and process lifecycle management for debugger attachment scenarios

## Public API Surface

**Main Entry Points:**
- `probe-target.js` - Execute with `--line 13` parameter for targeted debugging validation
- Designed for external debugger tool integration and DAP behavior testing

## Internal Organization & Data Flow

**Debugging Infrastructure:**
1. **Breakpoint Management** - Strategic placement of `debugger` statements and target variables for consistent debugging behavior
2. **Process Lifecycle Control** - Timeout/interval patterns ensuring processes remain available for debugger adoption
3. **Execution Markers** - Console logging providing clear execution state visibility

**Timing Architecture:**
- 500ms initialization delay for debugger attachment window
- Infinite interval loops preventing premature process termination
- Predictable execution flow for reliable testing

## Important Patterns & Conventions

**Debugging Stability:**
- Minimal dependencies (Node.js runtime only)
- Explicit process management for external tool integration
- Sequential execution with predictable timing windows

**Test Harness Design:**
- Simple, focused functionality optimized for debugger reliability
- Clear separation between debugging hooks and functional code
- Consistent breakpoint targeting for automated testing scenarios

## Usage Context
This experimental directory supports development tooling validation, particularly for debugging protocol implementation and debugger behavior testing. Components are designed to work with external debugging tools and provide controlled environments for testing debugger attachment, breakpoint handling, and process adoption scenarios.