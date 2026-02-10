# examples/visualizer/optimize_screenshots.py
@source-hash: 9adfbd71181ede86
@generated: 2026-02-09T18:14:57Z

## Purpose
Web-optimized screenshot compression utility for the MCP Debugger visualizer examples. Reduces file sizes for web delivery while preserving authentic debugging session content.

## Key Functions

### `optimize_screenshots()` (L13-95)
Main optimization function that processes PNG screenshots in the expected directory structure:
- Locates screenshots at `project_root/assets/screenshots/` 
- Processes 4 expected files: debugging-session.png, variable-inspection.png, mcp-integration.png, multi-session.png
- Applies PNG optimization with compress_level=9 and optimize=True
- Generates WebP versions (quality=90, method=6) for modern browsers
- Tracks and reports size reduction statistics
- Returns 0 on success, 1 on missing directory error

### `verify_authenticity()` (L98-108)
Informational function that prints authenticity requirements emphasizing that screenshots must be from real debugging sessions with no staging or mocking.

## Architecture & Dependencies
- **PIL/Pillow**: Core image processing library for optimization operations
- **pathlib**: Modern path handling for cross-platform file operations
- **Directory Structure**: Assumes `assets/screenshots/` relative to project root (3 levels up)

## Key Patterns
- **File Processing Loop**: Iterates through expected filenames with error handling per file
- **Dual Format Output**: Creates both optimized PNG and WebP versions for browser compatibility  
- **Size Tracking**: Accumulates original vs optimized sizes for comprehensive reporting
- **Graceful Degradation**: Continues processing remaining files if individual files fail

## Critical Constraints
- Screenshots must maintain 100% authenticity - no content modification allowed
- Only file size optimization permitted, not visual alterations
- Missing screenshot directory returns error code 1
- Individual file processing errors are logged but don't halt execution

## Entry Point
Main execution block (L110-120) includes Pillow dependency check and calls verify_authenticity() before optimization.