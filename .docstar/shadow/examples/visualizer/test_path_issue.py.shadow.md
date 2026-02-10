# examples/visualizer/test_path_issue.py
@source-hash: 2c0b2b1e9070fd96
@generated: 2026-02-09T18:14:58Z

## Purpose
Test script to debug path normalization issues in the `DebugVisualizer` component. Reproduces and investigates problems with file path handling between breakpoints and current location tracking.

## Key Functions

**`test_path_normalization()` (L10-46)**: Main test function that:
- Creates a `DebugVisualizer` instance (L14)
- Constructs path to `swap_vars.py` using relative path navigation (L17-19)
- Sets a breakpoint and examines resulting state changes (L25)
- Compares normalized paths between current location and breakpoints (L39-46)

## Dependencies
- `pathlib.Path`: For cross-platform path handling and normalization
- `examples.visualizer.debug_visualizer.DebugVisualizer`: The component being tested
- Dynamic path insertion (L6) to enable imports from project root

## Architecture & Patterns

**Path Construction Strategy (L17-19)**: Uses relative navigation from current file location to build paths, mirroring the approach used in demo scripts.

**Path Normalization Testing (L40-46)**: Applies `Path.resolve()` to compare absolute normalized paths, debugging whether path mismatches cause breakpoint/location inconsistencies.

**State Inspection Pattern (L28-36)**: Systematically examines visualizer internal state after operations to understand path handling behavior.

## Critical Relationships
- Tests interaction between `set_breakpoint()` method and `current_location` state updates
- Validates path consistency between `state.breakpoints` dictionary keys and `state.current_location.file_path`
- Target file: `examples/python_simple_swap/swap_vars.py` at line 4

## Testing Context
Specifically designed to reproduce path normalization bugs where breakpoints and current location tracking use different path representations, preventing proper matching and visualization updates.