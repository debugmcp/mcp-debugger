# examples/visualizer/prepare_demo_recording.py
@source-hash: 69e49b221b954611
@generated: 2026-02-10T00:41:37Z

## Purpose
Demo preparation utility that cleans the environment before recording visualizer demonstrations. Ensures clean state by removing logs and temporary files.

## Key Function
- `prepare_environment()` (L9-32): Main cleanup function that removes existing log files and position tracking files to ensure a pristine recording environment

## File Operations
- Removes debug log file at `project_root/logs/debug-mcp-server.log` (L12, L15-16)
- Ensures log directory exists (L20) 
- Removes visualizer position tracking file `.visualizer_position` (L23-25)

## Path Resolution
- Uses `Path(__file__).parent.parent.parent` (L11) to locate project root directory
- Constructs log file path relative to project structure

## User Guidance
Provides step-by-step instructions (L28-32) for:
1. Running demo_runner.py
2. Starting recording tool
3. Using MCP client for debugging commands

## Dependencies
- Standard library: `os`, `shutil`, `pathlib.Path`
- No external dependencies

## Execution
Standalone script - runs `prepare_environment()` when executed directly (L34-35)