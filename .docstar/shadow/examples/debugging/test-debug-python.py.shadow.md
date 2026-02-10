# examples/debugging/test-debug-python.py
@source-hash: 034c3624d6f52339
@generated: 2026-02-10T00:41:35Z

## Purpose
Test script designed for debugging with MCP (Model Context Protocol) debugger. Provides simple computational examples with deliberate print statements for debugging observation.

## Core Functions

### calculate_sum(a, b) (L4-8)
- **Purpose**: Adds two numbers with debug output
- **Behavior**: Prints operation details and returns sum
- **Usage**: Basic arithmetic testing with tracing

### process_list(items) (L10-16)
- **Purpose**: Iterates through list, accumulating sum with enumerated logging
- **Behavior**: Prints each item with index, maintains running total
- **Returns**: Total sum of all items

### main() (L18-36)
- **Purpose**: Orchestrates test sequence demonstrating various debugging scenarios
- **Flow**:
  - Simple variable assignment and calculation (L23-25)
  - List processing with predefined data (L28-29)
  - Variable manipulation and result combination (L32-33)
- **Returns**: Combined result of both calculations

## Execution Entry Point
- Script execution block (L38-40) calls main() and prints final result
- Designed for standalone execution with comprehensive output logging

## Architecture Notes
- Functional design with clear separation of concerns
- Heavy use of print statements for debugging visibility
- Simple data flow: individual calculations → list processing → result aggregation
- No external dependencies beyond standard Python library

## Debugging Features
- Explicit variable naming for easy inspection
- Step-by-step print statements at key operations
- Clear function boundaries for breakpoint placement
- Predictable execution flow suitable for debugging tool demonstration