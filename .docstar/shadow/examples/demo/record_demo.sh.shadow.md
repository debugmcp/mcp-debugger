# examples/demo/record_demo.sh
@source-hash: 8e8af9a476ce2a98
@generated: 2026-02-10T00:41:37Z

## Purpose
Bash script for recording terminal demonstrations of the MCP Debugger tool and converting them to GIF format for documentation purposes. Creates asciinema recordings and converts them to SVG animations for README integration.

## Key Components

### Dependency Checks (L8-20)
- **asciinema validation (L9-14)**: Checks if asciinema is installed, provides installation instructions for macOS and Ubuntu/Debian, exits if missing
- **svg-term-cli validation (L17-20)**: Checks for svg-term-cli and auto-installs via npm if missing

### Recording Process (L22-30)
- **Recording setup (L23-24)**: 3-second countdown before starting recording
- **asciinema recording (L26-30)**: Records terminal session with specific parameters:
  - Title: "MCP Debugger Demo"
  - Idle time limit: 2 seconds
  - Terminal dimensions: 80 columns × 30 rows
  - Output file: demo.cast

### Conversion Pipeline (L32-34)
- **SVG conversion (L34)**: Converts asciinema recording to SVG animation using svg-term with windowed appearance, no cursor, matching terminal dimensions

### User Guidance (L36-48)
- **Output summary (L38-41)**: Lists created files (demo.cast, demo.svg)
- **GIF conversion instructions (L43-46)**: Provides two options:
  1. Online converter (CloudConvert)
  2. Local ImageMagick conversion command
- **Integration guidance (L48)**: Instructions for moving GIF to repository root and updating README

## Architecture
- Linear execution flow with dependency validation upfront
- Fail-fast approach for missing critical dependencies (asciinema)
- Auto-installation for secondary dependencies (svg-term-cli)
- Multi-format output pipeline: terminal → asciinema cast → SVG → GIF (manual)

## Dependencies
- **asciinema**: Terminal session recorder (required)
- **svg-term-cli**: Cast-to-SVG converter (auto-installed)
- **npm**: For svg-term-cli installation
- **ImageMagick**: Optional for local GIF conversion