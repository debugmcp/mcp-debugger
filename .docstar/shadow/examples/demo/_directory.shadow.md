# examples/demo/
@generated: 2026-02-11T23:47:38Z

## Overall Purpose and Responsibility

The `examples/demo` directory provides demonstration and recording infrastructure for the MCP Debugger tool. It contains a complete theatrical demo simulation and the tooling necessary to record professional documentation materials, specifically designed to showcase the debugger's capabilities for README and promotional content.

## Key Components and Integration

### Demo Simulation (`mcp_debugger_demo.py`)
A self-contained theatrical presentation that simulates an AI agent debugging session without requiring actual debugger functionality. Features:
- **Interactive Terminal Display**: Color-coded output with timing delays to simulate real debugging
- **Educational Bug Scenario**: Classic variable swap bug demonstration with step-by-step resolution
- **Narrative Structure**: 11-stage debugging process from problem identification to solution verification

### Recording Infrastructure (`record_demo.sh`)
Automated recording and conversion pipeline that transforms the demo into distributable documentation:
- **Dependency Management**: Validates and auto-installs required recording tools
- **Multi-Format Pipeline**: Terminal → Asciinema cast → SVG → GIF conversion workflow
- **Production Ready**: Configured dimensions and timing for professional documentation

## Public API and Entry Points

### Primary Entry Points
- **`python mcp_debugger_demo.py`**: Runs the complete interactive debugging demonstration
- **`bash record_demo.sh`**: Records the demo session and generates documentation assets

### Output Artifacts
- **Terminal Demo**: Live interactive presentation suitable for screenshots or screen recording
- **Asciinema Cast**: Structured recording format (`demo.cast`)
- **SVG Animation**: Web-ready animation (`demo.svg`)
- **GIF Ready**: Instructions and tooling for final GIF conversion

## Internal Organization and Data Flow

The directory follows a two-stage workflow:

1. **Content Creation**: The Python demo script provides the actual demonstration content with carefully timed sequences and visual formatting
2. **Content Capture**: The shell script orchestrates the recording process, handling technical dependencies and format conversions

Data flows from live terminal presentation → recorded session → multiple output formats for different documentation contexts.

## Important Patterns and Conventions

### Demo Design Patterns
- **Time-Paced Narrative**: Uses deliberate delays (0.3-0.5s) to create natural viewing rhythm
- **Color-Coded Communication**: Different colors for LLM output (blue), debugger responses (green), and code highlighting (yellow)
- **Educational Structure**: Follows logical debugging methodology rather than tool-specific commands

### Recording Conventions
- **Standard Dimensions**: 80×30 terminal for consistent documentation appearance
- **Idle Time Management**: 2-second limit to keep recordings concise
- **Multi-Format Support**: Provides pathway from terminal recording to web-ready formats

This directory serves as a complete demonstration package, enabling both live presentations and the creation of high-quality documentation materials for the MCP Debugger project.