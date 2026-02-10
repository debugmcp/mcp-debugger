# examples/demo/
@generated: 2026-02-09T18:16:07Z

## Purpose
Demo showcase directory for the MCP Debugger project that provides tooling for creating promotional and documentation materials. Contains a complete pipeline for generating visual demonstrations of mcp-debugger capabilities through scripted terminal sessions.

## Key Components

### Demo Script (mcp_debugger_demo.py)
- **Theatrical debugging simulation**: Creates a scripted LLM debugging session that demonstrates finding and fixing a variable swap bug
- **Visual formatting system**: Color-coded output distinguishing between LLM responses (blue), debugger responses (green), code display, and variable states (purple)
- **Paced presentation**: Built-in timing delays for natural flow during recording
- **Self-contained demonstration**: No actual debugging dependencies - purely presentational with hardcoded responses

### Recording Pipeline (record_demo.sh)
- **Automated recording workflow**: Orchestrates terminal session capture using asciinema
- **Format conversion chain**: Transforms recordings from .cast → .svg → .gif for different use cases
- **Dependency management**: Auto-installs required tools and provides fallback instructions
- **Standardized output**: Consistent 80x30 terminal dimensions with optimized idle time handling

## Public API Surface

### Entry Points
- **`python mcp_debugger_demo.py`**: Runs the interactive debugging demonstration
- **`./record_demo.sh`**: Executes complete recording and conversion pipeline

### Output Artifacts
- **demo.cast**: Raw asciinema recording for replay and editing
- **demo.svg**: Web-ready animated visualization
- **demo.gif**: Final promotional material (via manual conversion)

## Internal Organization

### Data Flow
1. **Demo Script Execution**: Simulated 11-step debugging workflow with timed presentation
2. **Terminal Recording**: Captures formatted output with asciinema
3. **Format Pipeline**: Converts through multiple formats for different distribution channels
4. **Documentation Integration**: Generates materials suitable for README, docs, and promotional use

### Design Patterns
- **Separation of Concerns**: Demo logic isolated from recording infrastructure
- **Dependency Isolation**: Recording tools separate from demo content
- **Progressive Enhancement**: Multiple output formats for different use cases
- **User Experience Focus**: Optimized timing and visual formatting for audience engagement

## Module Relationships
This directory serves as the promotional and documentation frontend for the mcp-debugger project, providing ready-to-use demonstration materials that showcase the debugger's capabilities without requiring actual debugging infrastructure. The components work together to create a complete content generation pipeline for marketing and educational purposes.