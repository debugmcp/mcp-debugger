# examples/visualizer/test_panels.py
@source-hash: bbf61754baf9b39a
@generated: 2026-02-10T00:41:42Z

## Purpose
Standalone test script for debugging the CodeViewPanel component in the visualizer system. Tests different rendering scenarios with progressively complex parameters to isolate display issues.

## Key Functions
- **test_code_panel() (L12-65)**: Main test function that runs 4 progressive test cases:
  - Test 1 (L27-35): Basic file rendering without highlights
  - Test 2 (L37-45): File with current line highlighting 
  - Test 3 (L47-55): File with current line and breakpoints
  - Test 4 (L57-65): Full feature test with variables, breakpoints, and current line

## Dependencies
- **Rich Console (L8, 14)**: For terminal output rendering
- **CodeViewPanel (L9, 17)**: The component being tested from visualizer.panels
- **DebugState (L10)**: Imported but unused in current implementation
- **Path manipulation (L5-6, 20-22)**: Dynamic path resolution for test file location

## Test Data
- **Target file**: `examples/python_simple_swap/swap_vars.py` (L22)
- **Test parameters**: 
  - Current line: 4, 10 (L41, 61)
  - Breakpoints: {4, 10, 20} (L52, 62)
  - Variables: {'a': '10', 'b': '20'} (L63)

## Architecture Patterns
- **Progressive testing**: Each test builds on the previous with additional complexity
- **Path resolution**: Uses relative imports and dynamic path construction for portability
- **Console-based validation**: Visual inspection through Rich console output rather than automated assertions

## Execution Context
Entry point at L67-68 when run directly. Designed for manual debugging and visual verification of panel rendering behavior.