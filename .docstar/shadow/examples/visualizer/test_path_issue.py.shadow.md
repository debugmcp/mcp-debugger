# examples/visualizer/test_path_issue.py
@source-hash: 2c0b2b1e9070fd96
@generated: 2026-02-10T00:41:43Z

## Purpose
Debug test script for diagnosing path normalization issues in the DebugVisualizer component. Validates that file paths are correctly normalized when setting breakpoints and updating current location state.

## Key Components

**test_path_normalization() (L10-46)**
- Main test function that creates a DebugVisualizer instance and tests path handling
- Constructs path to `swap_vars.py` using relative navigation from current file location
- Sets a breakpoint at line 4 of the target file and examines resulting state
- Compares normalized paths between current location and breakpoint storage
- Prints detailed debugging information about path resolution

## Path Construction Logic (L17-19)
- Uses `Path(__file__).parent` navigation to locate project root
- Builds target file path: `project_root/examples/python_simple_swap/swap_vars.py`
- Converts to string for compatibility with DebugVisualizer API

## Dependencies
- **pathlib.Path**: For robust cross-platform path manipulation and resolution
- **DebugVisualizer**: From `examples.visualizer.debug_visualizer` - the component under test
- **sys.path modification (L6)**: Adds project root to Python path for imports

## Test Flow
1. Create DebugVisualizer instance (L14)
2. Construct target file path using relative navigation (L17-19)
3. Set breakpoint to trigger location state update (L25)
4. Examine and compare normalized paths in visualizer state (L28-46)
5. Validate path matching between current location and breakpoints (L39-46)

## Debugging Output
- Original vs resolved paths (L21-22)
- Current location state details (L28-32)
- All breakpoints in state (L34-36)
- Normalized path comparisons (L40-46)

## Architecture Notes
- Standalone test script with executable entry point (L48-49)
- Uses relative path navigation rather than hardcoded paths for portability
- Focuses specifically on path normalization edge cases in the visualizer