# examples/visualizer/convert_to_gif.py
@source-hash: da9cf0919ec35bef
@generated: 2026-02-09T18:14:58Z

## Purpose
Utility script that converts asciinema recording files (.cast) to optimized GIF animations for documentation/demo purposes. Part of a visualizer toolchain in an examples directory.

## Key Components

### Functions
- **check_tool()** (L9-16): Validates external tool availability using `which` command, prints installation instructions on failure
- **convert_to_gif()** (L18-57): Main conversion function that orchestrates the cast-to-GIF pipeline with configurable input file

### Conversion Pipeline (L18-57)
1. **Dependency Check** (L22-23): Ensures `agg` tool (asciinema-to-gif converter) is installed
2. **Path Resolution** (L25-29): Calculates project root (3 levels up) and creates output path at `assets/demo.gif`
3. **Conversion Execution** (L34-42): Invokes `agg` with optimized parameters:
   - Monokai theme for visual consistency
   - 14pt font size for readability
   - 1.2x playback speed for efficiency
   - 1.4 line height for spacing
4. **Size Validation** (L44-52): Warns if output exceeds 10MB GitHub limit, suggests optimization
5. **Cleanup Option** (L54-57): Interactive prompt to remove source cast file

## Dependencies
- **External Tools**: `agg` (asciinema GIF generator) via cargo install
- **Python Modules**: subprocess, pathlib for system interaction and file management
- **File Structure**: Assumes 3-level directory nesting from project root

## Architecture Notes
- **Path Convention**: Hard-coded project structure assumption (parent.parent.parent)
- **Default Input**: "mcp-debugger-demo-swap-bug.cast" suggests MCP (Model Context Protocol) debugging workflow
- **Output Location**: Standardized assets directory for demo materials
- **Interactive UX**: Includes progress feedback and user prompts for workflow control

## Configuration
- Theme: Monokai (dark theme optimized for code visibility)
- Performance: 1.2x speed, 14pt font for balance of readability and file size
- Size threshold: 10MB warning aligned with typical platform limits