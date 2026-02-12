# examples\demo/
@generated: 2026-02-12T21:00:51Z

## Purpose
Demo and documentation tooling directory for the mcp-debugger project. Provides a complete workflow for creating, recording, and distributing visual demonstrations of the MCP Debugger tool's capabilities through theatrical terminal presentations.

## Key Components and Architecture

### Demo Presentation Engine
- **mcp_debugger_demo.py**: Core demo script that simulates an AI debugging session
  - Terminal presentation layer with ANSI color formatting and theatrical timing
  - Simulated LLM-debugger interaction showing variable swap bug detection and resolution
  - 11-stage narrative walkthrough demonstrating typical debugging workflow
  - No actual debugging functionality - purely presentational for documentation

### Recording and Distribution Pipeline
- **record_demo.sh**: Automated recording and conversion tooling
  - Dependency management and validation (asciinema, svg-term-cli)
  - Terminal session capture with standardized dimensions (80x30)
  - Multi-format conversion pipeline: terminal → asciinema cast → SVG → GIF
  - Documentation integration guidance

## Public API and Entry Points

### Primary Entry Points
1. **Interactive Demo**: `python mcp_debugger_demo.py` - Run live terminal demonstration
2. **Recording Session**: `./record_demo.sh` - Create distributable demo recordings

### Output Artifacts
- **demo.cast**: asciinema terminal recording
- **demo.svg**: SVG animation for web integration
- **demo.gif**: Final format for README documentation (manual conversion)

## Data Flow and Integration
```
Demo Script → Terminal Presentation → asciinema Recording → SVG Animation → GIF → README Integration
```

## Design Patterns
- **Theatrical Presentation**: Time-delayed, color-coded output simulating real debugging sessions
- **Multi-Format Pipeline**: Progressive conversion from interactive demo to static documentation assets
- **Self-Contained Tooling**: Complete workflow from creation to distribution within single directory
- **Documentation-First**: Designed specifically for creating compelling visual documentation rather than functional debugging

## Dependencies and Requirements
- **Runtime**: Python 3.x with time/sys modules
- **Recording**: asciinema (required), svg-term-cli (auto-installed)
- **Optional**: ImageMagick for local GIF conversion

This directory serves as the complete demonstration and documentation asset generation system for showcasing mcp-debugger capabilities to users and developers.