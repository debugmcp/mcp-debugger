# tests/test-utils/fixtures/python/debug_test_simple.py
@source-hash: 890eb7a9078a359c
@generated: 2026-02-09T18:14:21Z

## Purpose
Test fixture for debugging purposes - a minimal Python script designed to run for an extended period to facilitate debugging testing scenarios.

## Core Components

**sample_function() (L11-15)**
- Simple arithmetic function that adds two hardcoded integers (5 + 10)
- Prints the result to stdout
- Serves as a basic debuggable unit with local variables

**Main Execution Flow (L7-22)**
- Prints Python version and startup messages
- Executes sample_function() 
- Sleeps for 60 seconds to maintain process alive for debugging
- Prints completion message before exit

## Dependencies
- `sys` - for Python version information
- `os` - imported but unused
- `time` - for sleep functionality

## Key Characteristics
- Designed for test environments requiring a long-running process
- Minimal complexity to avoid interference with debugging scenarios
- Predictable output and timing for test automation
- Self-contained with no external dependencies beyond stdlib

## Usage Context
Located in test utilities fixtures, indicating this is used by test frameworks that need to spawn and debug Python processes with known behavior and timing.