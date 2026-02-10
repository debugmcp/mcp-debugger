# examples/demo/record_demo.sh
@source-hash: 8e8af9a476ce2a98
@generated: 2026-02-09T18:14:51Z

## Purpose
Bash script for recording terminal demos of the MCP Debugger as GIF animations for documentation purposes. Orchestrates the complete workflow from recording to format conversion.

## Key Components

### Dependency Checks (L8-20)
- **asciinema validation (L9-14)**: Checks if asciinema is installed, exits with platform-specific installation instructions if missing
- **svg-term auto-install (L16-20)**: Checks for svg-term-cli and automatically installs via npm if not found

### Recording Pipeline (L22-34)
- **asciinema recording (L26-30)**: Records terminal session with specific parameters:
  - Title: "MCP Debugger Demo"
  - Idle time limit: 2 seconds (cuts long pauses)
  - Terminal dimensions: 80x30 characters
  - Output: demo.cast file
- **SVG conversion (L34)**: Converts asciinema cast to SVG animation with window chrome

### Output Files
- `demo.cast`: Raw asciinema recording format
- `demo.svg`: SVG animation suitable for web display

### User Guidance (L36-48)
Provides manual conversion instructions for final GIF creation, including online tools and ImageMagick commands.

## Dependencies
- **asciinema**: Terminal recording tool (required)
- **svg-term-cli**: NPM package for cast-to-SVG conversion (auto-installed)
- **ImageMagick**: Optional, for SVG-to-GIF conversion (user responsibility)

## Workflow Pattern
Linear pipeline: dependency validation → recording → format conversion → user instructions for final step.