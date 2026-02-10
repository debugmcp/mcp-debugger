# examples/demo/mcp_debugger_demo.py
@source-hash: 3e13ba4b7b855a10
@generated: 2026-02-09T18:14:55Z

## Purpose
Demo script that simulates an LLM debugging session to showcase mcp-debugger capabilities. Creates a theatrical presentation of finding and fixing a variable swap bug for recording as promotional material.

## Key Components

### Color System
- **Colors class (L17-26)**: ANSI color codes for terminal output formatting
- Provides visual distinction between different actors in the demo

### Output Functions
- **print_llm() (L28-31)**: Formats messages as LLM responses with blue robot emoji, includes timing delays
- **print_debugger() (L33-36)**: Formats debugger responses with green bug emoji, shorter delays  
- **print_code() (L38-47)**: Displays code with line numbers, optionally highlights specific line in yellow
- **print_variables() (L49-54)**: Shows variable states in purple formatting
- **demo_title() (L56-61)**: Prints formatted demo header with timing

### Main Demo Logic
- **main() (L63-147)**: Orchestrates the complete debugging demonstration
  - Defines buggy swap code with intentional variable overwrite bug (L65-75)
  - Simulates 11-step debugging process:
    1. Task identification
    2. Debug session creation
    3. Code examination
    4. Breakpoint setting at line 4
    5. Script execution
    6. Variable inspection (a=10, b=20)
    7. Step-over execution
    8. Post-assignment inspection (a=20, b=20)
    9. Bug identification and explanation
    10. Solution presentation using tuple unpacking
    11. Verification of fix

### Script Structure
- Entry point with keyboard interrupt handling (L148-153)
- Uses time.sleep() throughout for paced presentation timing
- Hardcoded variable values and responses for consistent demo experience

## Dependencies
- Standard library: time, sys, pathlib (Path imported but unused)
- No external dependencies

## Architectural Notes
- Purely presentational - no actual debugging functionality
- Designed for video/GIF capture with visual formatting
- Simulates both sides of LLM-debugger interaction
- Self-contained with embedded code examples