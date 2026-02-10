# examples/visualizer/demo_mock.py
@source-hash: fc50915a74cf4046
@generated: 2026-02-10T00:41:46Z

## Purpose
Mock demonstration script for the MCP Debug Visualizer TUI. Simulates a complete debugging session using the `swap_vars.py` example to showcase visualizer capabilities without requiring actual debugging infrastructure.

## Key Functions

### `run_mock_debugging_session(viz: DebugVisualizer)` (L25-197)
Core simulation function that orchestrates a 19-step debugging session:
- **Path Resolution (L32-41)**: Calculates absolute path to `swap_vars.py` example file with existence validation
- **Step Definition (L44-182)**: Defines array of debugging steps, each containing:
  - `action`: Lambda function calling visualizer methods
  - `delay`: Sleep duration between steps (2.0-3.0 seconds)
  - `description`: Human-readable step description
- **Execution Loop (L184-191)**: Executes steps sequentially with error handling that silently breaks on exceptions
- **Cleanup (L193-197)**: Final delay and visualizer shutdown

**Step Sequence Highlights**:
- Session creation and breakpoint setting (steps 1-4)
- Debug start and breakpoint hits (steps 5-6)
- Variable state tracking through buggy swap execution (steps 7-15)
- Program flow continuation and error demonstration (steps 16-19)

### `main()` (L200-232)
Entry point providing user interface and thread management:
- **User Instructions (L202-211)**: Prints demo description and capabilities
- **Thread Orchestration (L217-222)**: Launches mock session in daemon thread
- **Visualizer Execution (L224-232)**: Runs blocking visualizer with comprehensive error handling

## Dependencies
- **External**: `time`, `os`, `threading`, `sys`, `pathlib.Path`
- **Internal**: `DebugVisualizer` from `examples.visualizer.debug_visualizer`
- **Path Manipulation (L19-20)**: Dynamic sys.path modification for relative imports

## Architecture Patterns
- **Producer-Consumer**: Main thread runs visualizer UI, daemon thread feeds mock data
- **State Machine Simulation**: Sequential step execution mimics real debugging flow
- **Error Isolation**: Silent exception handling in simulation to prevent TUI corruption
- **Resource Management**: Proper cleanup with `viz.stop()` call

## Critical Constraints
- **File Dependency**: Requires `examples/python_simple_swap/swap_vars.py` to exist
- **Timing Sensitive**: Fixed delays between steps (may need adjustment for different systems)
- **Thread Safety**: Assumes DebugVisualizer is thread-safe for concurrent updates
- **Mock Fidelity**: Variable states and line numbers must match actual `swap_vars.py` structure

## Demo Flow
Simulates discovering a buggy variable swap where `a = b; b = a` results in both variables having the same value, demonstrating how the visualizer tracks variable state changes and execution flow through breakpoints.