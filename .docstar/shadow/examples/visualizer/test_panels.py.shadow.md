# examples/visualizer/test_panels.py
@source-hash: bbf61754baf9b39a
@generated: 2026-02-09T18:14:59Z

## Primary Purpose
Testing/debugging script for the CodeViewPanel component in a visualizer application. Provides isolated tests to verify code panel rendering functionality with various debug states.

## Key Components

### Main Test Function
- `test_code_panel()` (L12-65): Comprehensive test suite for CodeViewPanel rendering
  - Tests 4 scenarios: file-only, current line highlighting, breakpoints, and variables
  - Uses `swap_vars.py` from examples as test subject
  - Outputs results to console using Rich library

### Test Scenarios
1. **File-only rendering** (L27-35): Basic code display without debug features
2. **Current line highlighting** (L37-45): Tests line 4 highlighting capability  
3. **Breakpoint visualization** (L47-55): Tests breakpoints at lines 4, 10, 20
4. **Variable display** (L57-65): Tests variable overlay with sample data

### Path Resolution
- Dynamic path construction (L19-22): Locates target file relative to script location
- Path validation (L24-25): Verifies file existence before testing

## Dependencies
- **Rich Console** (L8): Terminal rendering and formatting
- **CodeViewPanel** (L9): Core component under test from visualizer.panels
- **DebugState** (L10): Debug state management (imported but unused)

## Architecture Notes
- Standalone testing approach allows isolated debugging of UI components
- Uses relative path navigation to maintain portability across project structures
- Progressive complexity in test cases from simple to feature-complete scenarios

## Entry Point
- Script execution (L67-68): Direct invocation runs complete test suite