# scripts/experiments/
@generated: 2026-02-10T21:26:12Z

## Purpose
Development testing utilities for experimental debugging and protocol validation. This directory contains specialized scripts designed to support DAP (Debug Adapter Protocol) behavior testing and debugger tool validation in controlled environments.

## Key Components

**Test Targets:**
- `probe-target.js` - Minimal debugging test harness providing reliable breakpoint targets and process lifecycle management for debugger attachment scenarios

## Public API Surface

**Entry Points:**
- `probe-target.js` - Execute with `--line 13` parameter for targeted debugging tests
  - Provides immediate debugger statement breakpoint
  - Offers predictable breakpoint target at line 13 (`probeVar`)
  - Includes simple arithmetic function for step-through testing

## Internal Organization & Data Flow

**Execution Flow:**
1. Immediate debugger hook activation
2. Variable declaration for breakpoint targeting
3. Function definition for step-through scenarios  
4. Delayed execution phase (500ms) for debugger attachment window
5. Keep-alive interval to prevent process termination

**Process Management:**
- Controlled timing with 500ms delay for external tool attachment
- Infinite interval loop ensuring process remains available for debugger adoption
- Console logging providing execution state visibility

## Patterns & Conventions

**Testing Architecture:**
- Minimal dependency design (Node.js runtime only)
- Explicit process lifecycle management for external debugger integration
- Sequential execution with predictable timing for reliable test conditions
- Multiple debugging hook types (statement, line target, step-through function)

## Usage Context
Supports debugging tool development and DAP implementation validation by providing stable, predictable test targets. Designed for scenarios requiring debugger attachment, process adoption, and breakpoint behavior verification in controlled test environments.