# examples/visualizer/demo_mock.py
@source-hash: fc50915a74cf4046
@generated: 2026-02-09T18:15:01Z

**examples/visualizer/demo_mock.py** - Mock debugging session demo for the TUI visualizer.

## Purpose
Demonstrates the DebugVisualizer TUI capabilities by simulating a complete debugging session on the `swap_vars.py` example file. Creates a realistic debugging flow with breakpoints, variable inspection, and step-by-step execution without requiring an actual debugger.

## Key Functions

### run_mock_debugging_session(viz) (L25-197)
Core simulation engine that orchestrates a 19-step mock debugging session:
- Validates target file existence (`swap_vars.py`) (L37-41)
- Defines step sequence with actions, delays, and descriptions (L44-182)
- Each step is a dict containing lambda action, delay timing, and description
- Simulates realistic debugging workflow: session creation → breakpoints → stepping → variable inspection
- Silent error handling to prevent TUI interference (L189-191)
- Automatically stops visualizer after completion (L197)

**Key simulation steps:**
- Session creation with ID "abc-123-def-456" (L47)
- Breakpoint placement at lines 4, 10, 20 (L54-70)
- Variable state updates showing bug progression (L89, L117, L145-150)
- Step commands with different types ("over") (L96, L103, etc.)
- Continue/pause cycle demonstration (L131, L138)

### main() (L200-232)
Entry point providing user interface and orchestration:
- Informational output about demo capabilities (L202-210)
- Creates DebugVisualizer instance (L214)
- Launches mock session in daemon thread (L217-222)
- Handles visualizer execution with proper exception handling (L224-232)

## Dependencies
- **DebugVisualizer**: Main TUI component being demonstrated (L22)
- **Threading**: Concurrent execution of simulation and UI (L15, L217)
- **Path/OS**: File system navigation and validation (L17, L14)

## Architecture Pattern
**Threaded Simulation**: Uses daemon thread to run mock debugging session while main thread handles TUI interaction. This prevents blocking and allows clean shutdown.

## File Resolution
Dynamically calculates path to target `swap_vars.py` file using relative path navigation from current file location (L33-35). Falls back gracefully if file not found.

## Timing Control
Each simulation step includes calibrated delays (2.0-3.0 seconds) to provide realistic debugging session pacing and allow users to observe state changes.