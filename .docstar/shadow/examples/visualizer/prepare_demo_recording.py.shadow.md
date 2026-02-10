# examples/visualizer/prepare_demo_recording.py
@source-hash: 69e49b221b954611
@generated: 2026-02-09T18:14:54Z

## Purpose
Demo recording preparation utility that cleans the environment state before capturing clean demo recordings of the MCP debugging visualizer.

## Core Function
- **prepare_environment() (L9-32)**: Main cleanup function that removes logs and tracking files to ensure a pristine recording environment

## Key Operations
1. **Log Cleanup (L11-20)**: Locates and removes existing debug log file at `{project_root}/logs/debug-mcp-server.log`, then ensures log directory exists
2. **Position Tracking Cleanup (L22-25)**: Removes `.visualizer_position` file that tracks visualizer state between sessions
3. **User Guidance (L27-32)**: Provides step-by-step instructions for demo recording workflow

## File System Dependencies
- Assumes three-level directory structure: file is in `examples/visualizer/` relative to project root
- Interacts with `logs/debug-mcp-server.log` for log management
- Manages `.visualizer_position` file in current working directory

## Architectural Context
Part of MCP debugging visualizer demo infrastructure. Designed to be run before `demo_runner.py` to ensure clean recording state. Supports multi-terminal workflow where recording tool, demo runner, and MCP client operate simultaneously.

## Usage Pattern
Standalone script executed before demo recording sessions to reset environment state and provide user guidance for the recording workflow.