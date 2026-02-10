# examples/demo/
@generated: 2026-02-10T01:19:38Z

## Purpose
The `examples/demo` directory provides demonstration and recording infrastructure for the MCP Debugger tool. It contains a theatrical demo script that simulates an AI-powered debugging session and tooling for recording professional documentation assets.

## Key Components

### Demo Simulation (`mcp_debugger_demo.py`)
- **Interactive Demo Engine**: Creates a realistic simulation of an LLM debugging a variable swap bug using theatrical presentation with color-coded output and timing delays
- **Visual Components**: ANSI color formatting, emoji-enhanced output, code highlighting, and variable inspection displays
- **11-Stage Debugging Narrative**: Complete walkthrough from task identification through bug discovery to solution verification
- **Educational Content**: Demonstrates classic swap bug pattern and Python tuple unpacking solution

### Recording Infrastructure (`record_demo.sh`)
- **Automated Recording Pipeline**: Handles terminal session capture using asciinema with optimized settings for documentation
- **Format Conversion Chain**: Converts recordings to SVG animations and provides GIF conversion guidance
- **Dependency Management**: Validates and auto-installs required tools (asciinema, svg-term-cli)
- **Documentation Integration**: Provides clear instructions for incorporating generated assets into project README

## Component Integration
The two components form a complete demo-to-documentation pipeline:
1. `mcp_debugger_demo.py` provides the engaging content to be recorded
2. `record_demo.sh` captures and processes this content into shareable formats
3. Generated assets (GIF/SVG) integrate into project documentation for visual learning

## Public API / Entry Points
- **`python mcp_debugger_demo.py`**: Runs the interactive debugging simulation
- **`./record_demo.sh`**: Records demo session and generates documentation assets
- **Output Artifacts**: `demo.cast`, `demo.svg`, and guidance for `demo.gif` creation

## Architecture Pattern
**Demo-as-Code**: The directory implements a documentation-driven approach where demonstrations are scripted, recordable, and reproducible. This ensures consistent presentation quality and enables easy updates to demo content while maintaining professional documentation standards.

## Use Cases
- Creating visual documentation for README files
- Recording product demonstrations for presentations  
- Providing interactive learning materials for debugging concepts
- Generating consistent, professional demo assets for marketing/educational purposes