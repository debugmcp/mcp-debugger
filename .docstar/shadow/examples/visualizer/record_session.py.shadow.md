# examples/visualizer/record_session.py
@source-hash: 5e66985eec688eb5
@generated: 2026-02-09T18:14:58Z

## Purpose
Utility script for recording debugging demonstration sessions using asciinema for the MCP debugger project. Creates terminal recordings that can be converted to GIFs for documentation purposes.

## Key Functions
- `main()` (L9-48): Orchestrates the entire recording workflow
  - Validates asciinema installation via subprocess check (L13-21)
  - Displays user instructions for demo setup (L23-33)
  - Launches asciinema recording with predefined configuration (L38-45)

## Dependencies
- `subprocess`: For system command execution (asciinema validation and recording)
- `sys`: For script termination on missing dependencies
- `pathlib.Path`: Imported but unused in current implementation

## Workflow
1. **Dependency Check**: Verifies asciinema availability using `which` command
2. **User Guidance**: Provides comprehensive setup instructions including terminal sizing
3. **Interactive Start**: Waits for user confirmation before recording
4. **Recording Configuration**: 
   - Fixed filename: "mcp-debugger-demo-swap-bug.cast"
   - Terminal size: 120x30
   - Idle time limit: 3 seconds
   - Descriptive title for the recording

## Architecture Notes
- Script assumes external demo_runner.py process is already running
- Hard-coded recording parameters optimized for demo presentation
- Provides fallback installation instructions for multiple platforms
- Uses subprocess.run() for both validation and recording execution

## Integration Context
Part of visualizer toolchain - output feeds into convert_to_gif.py for final processing. Designed for creating standardized demo recordings of MCP debugger capabilities, specifically focused on variable swap bug scenarios.