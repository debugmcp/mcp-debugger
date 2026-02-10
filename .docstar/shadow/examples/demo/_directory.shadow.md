# examples/demo/
@generated: 2026-02-10T21:26:17Z

## Overall Purpose
The `examples/demo` directory provides a complete demonstration system for the MCP Debugger tool, designed to create compelling visual documentation and marketing materials. It combines a theatrical debugging simulation with professional recording capabilities to showcase the debugger's value proposition.

## Key Components and Integration

### Core Demo Components
- **mcp_debugger_demo.py**: A theatrical simulation script that presents an AI agent debugging session
  - Creates a step-by-step narrative showing bug discovery and resolution
  - Uses color-coded terminal output and strategic delays for visual appeal
  - Demonstrates a classic variable swap bug and its solution
  - No actual debugging functionality - purely presentational

- **record_demo.sh**: Professional recording and conversion pipeline
  - Handles asciinema terminal recording with optimized settings
  - Converts recordings to SVG format for web integration
  - Provides guidance for GIF conversion and README integration
  - Includes dependency management and validation

### Workflow Integration
The components work together in a sequential workflow:
1. `mcp_debugger_demo.py` provides the content to be recorded
2. `record_demo.sh` captures this content as a professional terminal recording
3. The recording is converted through multiple formats (cast → SVG → GIF) for documentation use

## Public API / Entry Points
- **Demo Execution**: `python mcp_debugger_demo.py` - Runs the theatrical debugging simulation
- **Recording Pipeline**: `./record_demo.sh` - Captures and processes demo recordings
- **Output Artifacts**: 
  - `demo.cast` (asciinema recording)
  - `demo.svg` (web-ready animation)
  - Final GIF for README integration

## Internal Organization
### Data Flow
```
Demo Script → Terminal Output → asciinema Recording → SVG Animation → GIF → Documentation
```

### Architecture Patterns
- **Separation of Concerns**: Demo content separated from recording infrastructure
- **Multi-format Pipeline**: Progressive conversion through different media formats
- **Dependency Management**: Automated validation and installation of required tools
- **Graceful Degradation**: Fail-fast for critical dependencies, auto-install for secondary ones

## Key Conventions
- **Visual Design**: Consistent color coding (blue for LLM, green for debugger, yellow for highlights)
- **Timing Control**: Strategic delays for natural pacing in recordings
- **Terminal Optimization**: Fixed dimensions (80×30) and idle limits for consistent output
- **Error Handling**: Keyboard interrupt support and dependency validation

## Target Use Cases
- **Documentation**: README.md integration with visual demonstrations
- **Marketing Materials**: Professional-quality terminal recordings for presentations
- **Educational Content**: Step-by-step debugging workflow illustration
- **Development Workflow**: Reproducible demo recording for version updates