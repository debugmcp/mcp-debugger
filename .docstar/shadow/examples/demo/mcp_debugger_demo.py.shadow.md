# examples/demo/mcp_debugger_demo.py
@source-hash: a030b0ba28c3aade
@generated: 2026-02-10T01:19:02Z

## Purpose
Demo script that simulates an LLM debugging session using mcp-debugger. Creates a theatrical presentation showing how an AI agent would find and fix a variable swap bug, designed for recording as README documentation.

## Key Components

### Display Classes and Functions
- **Colors (L16-25)**: ANSI color code constants for terminal formatting (BLUE, GREEN, YELLOW, RED, MAGENTA, CYAN, BOLD, UNDERLINE, END)
- **print_llm (L27-30)**: Formats and displays LLM messages with blue robot emoji, includes 0.5s delay
- **print_debugger (L32-35)**: Formats debugger output with green bug emoji, includes 0.3s delay  
- **print_code (L37-46)**: Displays code with line numbers, optional line highlighting in yellow
- **print_variables (L48-53)**: Shows variable name-value pairs with magenta formatting
- **demo_title (L55-60)**: Prints formatted demo header with decorative borders

### Main Demo Logic
- **main (L62-145)**: Orchestrates complete debugging simulation
  - Defines buggy swap code (L64-74) with intentional variable overwrite bug
  - Steps through 11-stage debugging process:
    1. Task identification
    2. Debug session creation
    3. Code examination
    4. Breakpoint setting (line 4)
    5. Script execution
    6. Initial variable inspection (a=10, b=20)
    7. Step-over execution
    8. Post-assignment inspection (a=20, b=20)
    9. Bug identification and explanation
    10. Solution presentation using tuple unpacking
    11. Verification output

### Entry Point
- **Main execution (L147-152)**: Handles script execution with KeyboardInterrupt graceful exit

## Architecture Pattern
Sequential narrative demo using time delays and color-coded output to simulate interactive debugging session. No actual debugging capabilities - purely presentational.

## Dependencies
- `time`: For pacing delays
- `sys`: For clean exit handling

## Bug Demonstration
The demo centers on a classic swap bug where `a = b; b = a` pattern fails because the original value of `a` is lost after the first assignment. Solution shows Python's tuple unpacking (`a, b = b, a`) as the correct approach.