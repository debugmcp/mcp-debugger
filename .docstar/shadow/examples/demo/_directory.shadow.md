# examples\demo/
@children-hash: 1dc44163a06bebe2
@generated: 2026-02-15T09:01:22Z

## Purpose
The `examples/demo` directory provides a complete demonstration and documentation recording system for the MCP Debugger tool. It combines a theatrical Python simulation of debugging session with automated recording infrastructure to create visual documentation materials for README and marketing purposes.

## Key Components

### Demo Simulation (`mcp_debugger_demo.py`)
- **Theatrical debugging session**: Simulates an AI agent debugging a classic variable swap bug
- **Visual formatting system**: Color-coded terminal output with timing delays for recording
- **Narrative structure**: 11-stage debugging process from problem identification to solution
- **Educational content**: Demonstrates tuple unpacking as solution to variable swap bug

### Recording Infrastructure (`record_demo.sh`)
- **Automated recording pipeline**: Captures terminal sessions using asciinema
- **Multi-format conversion**: Transforms recordings to SVG animations and provides GIF conversion guidance
- **Dependency management**: Validates and auto-installs required tools (asciinema, svg-term-cli)
- **Documentation integration**: Provides complete workflow from recording to README embedding

## Public API and Usage

### Primary Entry Points
1. **Direct demo execution**: `python mcp_debugger_demo.py` - Runs interactive debugging simulation
2. **Recorded demo creation**: `bash record_demo.sh` - Captures and processes demo for documentation

### Workflow Integration
The components work together in a two-stage process:
1. **Content Creation**: Demo script provides structured, visually appealing debugging narrative
2. **Documentation Generation**: Recording script captures the demo and converts it to embeddable formats (SVG/GIF)

## Internal Organization

### Data Flow
```
Demo Script → Terminal Output → Asciinema Recording → SVG Animation → GIF (manual) → README Integration
```

### Content Structure
- **Bug demonstration**: Classic swap problem (`a, b = 10, 20` → incorrect swap → correct tuple unpacking)
- **Debugging stages**: Systematic progression through breakpoints, variable inspection, and solution identification
- **Visual presentation**: Color coding (blue for LLM, green for debugger, yellow for highlights, magenta for variables)

## Important Patterns

### Presentation Conventions
- **Timing control**: Strategic delays (0.5s for LLM, 0.3s for debugger) for natural recording pace
- **Color consistency**: Standardized ANSI color scheme across all output types
- **Graceful handling**: Keyboard interrupt support for clean demo termination

### Recording Standards
- **Fixed dimensions**: 80×30 terminal size for consistent output
- **Idle time management**: 2-second limit prevents long pauses in recordings
- **Multiple output formats**: Supports both development (cast files) and production (SVG/GIF) needs

This directory serves as both a functional demo and a documentation generation system, bridging the gap between technical capability demonstration and user-facing marketing materials.