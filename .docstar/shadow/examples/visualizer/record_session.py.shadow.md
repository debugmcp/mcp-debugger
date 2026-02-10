# examples/visualizer/record_session.py
@source-hash: 5e66985eec688eb5
@generated: 2026-02-10T00:41:41Z

## Purpose
Script for recording terminal sessions of MCP debugger demonstrations using asciinema. Creates screencasts for documentation and demo purposes.

## Core Functionality

**main() (L9-48)**: Primary orchestrator function that:
- Validates asciinema installation via subprocess check (L13)
- Provides comprehensive user instructions and terminal setup guidance (L23-32)
- Configures and launches asciinema recording with specific parameters for demo consistency (L38-45)
- Outputs post-recording workflow instructions (L47-48)

## Key Dependencies
- `subprocess`: Used for system command execution and asciinema availability checking
- `sys`: Provides exit functionality for error conditions
- `pathlib.Path`: Imported but unused in current implementation

## Configuration Parameters
- **Output filename**: Hardcoded as "mcp-debugger-demo-swap-bug.cast" (L36)
- **Terminal dimensions**: Fixed at 120x30 for consistent demo appearance (L42-43)
- **Idle timeout**: 3 seconds to trim dead time in recordings (L41)
- **Recording title**: Descriptive metadata for the cast file (L40)

## Workflow Integration
Positioned as part of a larger demo pipeline:
1. Expects `demo_runner.py` to be running concurrently
2. References `convert_to_gif.py` as the next step in the processing chain
3. Targets specific debugging scenario (variable swap bug demonstration)

## Error Handling
Robust asciinema dependency checking with multi-platform installation instructions and fallback suggestions for alternative recording methods (L13-21).