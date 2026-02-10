# examples/visualizer/optimize_screenshots.py
@source-hash: ed1e3875a3cfd8be
@generated: 2026-02-10T01:19:01Z

## Purpose and Responsibility

This utility script optimizes screenshot file sizes for web delivery while maintaining image authenticity. It specifically processes MCP debugger screenshots, providing both PNG optimization and WebP conversion for modern browsers.

## Key Functions

### `optimize_screenshots()` (L13-95)
Main optimization function that:
- Locates screenshot directory at `project_root/assets/screenshots` (L16-17)
- Processes 4 expected screenshot files: debugging-session.png, variable-inspection.png, mcp-integration.png, multi-session.png (L30-35)
- Optimizes PNG files using PIL with `optimize=True` and `compress_level=9` (L61-66)
- Creates WebP versions with 90% quality and method=6 for modern browsers (L76-77)
- Tracks and reports size reductions and file statistics (L37-38, L71-73)
- Returns exit code (0 for success, 1 for missing directory)

### `verify_authenticity()` (L98-108)
Prints authenticity reminder messages emphasizing that optimizations only affect file size, not content integrity.

## Dependencies and Architecture

- **PIL (Pillow)**: Core image processing library for PNG optimization and WebP conversion
- **pathlib.Path**: File system navigation relative to script location (L16)
- **sys**: Exit code handling in main block (L112)

## Key Patterns

- **Relative path resolution**: Uses `__file__` parent navigation to locate assets directory
- **Defensive programming**: Checks for directory/file existence before processing (L19-22, L43-45)
- **Dual format strategy**: Maintains original PNG while creating WebP alternatives
- **Progress reporting**: Detailed console output with file sizes and reduction percentages
- **Error handling**: Try/catch blocks around image operations (L49, L82-84)

## Critical Constraints

- **Authenticity requirement**: All screenshots must be from genuine debugging sessions (emphasized in L5-6, L100-107)
- **Fixed file expectations**: Hardcoded list of 4 specific screenshot filenames
- **Directory structure dependency**: Assumes `assets/screenshots` relative to project root
- **PNG-only optimization**: Only processes PNG files, creates WebP as additional format