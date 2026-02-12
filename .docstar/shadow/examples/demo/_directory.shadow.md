# examples\demo/
@generated: 2026-02-12T21:05:42Z

## Purpose
The `examples/demo` directory provides a complete demonstration and recording system for the MCP Debugger tool. It contains both the demo content and infrastructure for creating professional documentation materials, specifically designed to showcase the debugger's capabilities for README and marketing purposes.

## Key Components

### Demo Content
- **mcp_debugger_demo.py**: Interactive theatrical simulation of an AI agent debugging session
  - Simulates finding and fixing a classic variable swap bug
  - Uses color-coded terminal output and timing delays for realistic presentation
  - Demonstrates the complete debugging workflow from problem identification to solution verification
  - No actual debugging capabilities - purely presentational for documentation

### Recording Infrastructure
- **record_demo.sh**: Automated recording and conversion pipeline
  - Captures terminal demonstrations using asciinema
  - Converts recordings to SVG animations
  - Provides guidance for final GIF conversion and integration
  - Handles dependency validation and auto-installation

## Public API Surface
The directory serves two primary use cases:

### For Demo Recording
1. Execute `record_demo.sh` to start the recording pipeline
2. Run `python mcp_debugger_demo.py` during recording to demonstrate the tool
3. Follow provided instructions for GIF conversion and README integration

### For Live Demonstrations
- Direct execution of `mcp_debugger_demo.py` for interactive presentations
- Self-contained demo that requires no actual debugger setup

## Internal Organization
The components follow a producer-consumer pattern:
- **Demo script** produces the visual demonstration content
- **Recording script** consumes and packages that content for distribution
- Both components are designed to work independently or together

## Data Flow
1. Demo script generates formatted, timed terminal output
2. Recording script captures this output via asciinema
3. Pipeline converts recordings to web-friendly formats (SVG → GIF)
4. Final assets integrate into project documentation

## Important Patterns
- **Theatrical timing**: Strategic delays and formatting create realistic interaction simulation
- **Dependency management**: Graceful handling of missing tools with helpful error messages
- **Multi-format pipeline**: Supports various output formats for different documentation needs
- **Self-documenting**: Scripts provide clear usage instructions and next steps

## Bug Demonstration Focus
The demo centers on a pedagogical example - the classic swap algorithm bug where `a = b; b = a` fails due to variable overwriting, solved elegantly with Python's tuple unpacking syntax `a, b = b, a`. This provides a clear, relatable debugging scenario that demonstrates the tool's value proposition.