# examples/visualizer/convert_to_gif.py
@source-hash: da9cf0919ec35bef
@generated: 2026-02-10T00:41:40Z

**Purpose**: Utility script for converting asciinema terminal recordings (.cast files) to optimized GIF animations using the `agg` tool.

**Core Functions**:
- `check_tool(tool_name, install_hint)` (L9-16): Validates external tool availability using `which` command, provides installation guidance on failure
- `convert_to_gif(cast_file)` (L18-57): Main conversion pipeline that processes asciinema recordings to GIF format

**Conversion Pipeline** (L18-57):
1. **Dependency validation**: Ensures `agg` tool is installed via cargo
2. **Path resolution**: Constructs output path as `project_root/assets/demo.gif` (L25-26)
3. **Directory setup**: Creates assets directory if missing (L29)
4. **Conversion execution**: Calls `agg` with optimized parameters:
   - Monokai theme for visual appeal
   - 14px font size for readability  
   - 1.2x playback speed for efficiency
   - 1.4 line height for clarity
5. **Size validation**: Warns if output exceeds 10MB GitHub limit (L50-52)
6. **Cleanup option**: Interactive prompt to remove source .cast file (L55-57)

**Key Dependencies**:
- External: `agg` (asciinema-to-gif converter via cargo)
- Internal: `subprocess`, `pathlib.Path` for file operations
- Default input: `"mcp-debugger-demo-swap-bug.cast"`

**Architecture Notes**:
- Script assumes three-level directory structure (`examples/visualizer/` → project root)
- Hard-coded output location (`assets/demo.gif`) suggests standardized project layout
- Interactive cleanup workflow requires user input, not suitable for automated pipelines
- No error handling for subprocess failures during conversion