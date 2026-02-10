# examples/visualizer/optimize_gif.py
@source-hash: 58b0db8328099909
@generated: 2026-02-09T18:14:54Z

## Purpose
Utility script for optimizing GIF file size using the `gifsicle` command-line tool, applying progressive compression levels while maintaining acceptable quality.

## Key Functions

**optimize_gif() (L8-103)**
- Main optimization function that applies 4 progressive optimization levels
- Checks for gifsicle dependency and demo.gif existence
- Creates backup before modification and applies optimization strategies:
  1. Basic optimization (--optimize=3)
  2. Color reduction (128 colors)
  3. Lossy compression (30% lossy)
  4. Maximum compression (64 colors, 50% lossy, 90% scale)
- Exits early when file size drops below 10MB target

**cleanup_backup() (L105-118)**
- Compares original vs optimized file sizes
- Displays compression statistics (MB saved, percentage reduction)
- Prompts user to keep or remove backup file

## Dependencies
- `subprocess`: Execute gifsicle commands
- `pathlib.Path`: File system operations
- External dependency: `gifsicle` command-line tool

## File Operations
- Input: `../../../assets/demo.gif` (relative to script location)
- Backup: `demo.original.gif` in same directory
- Uses `cp` command for file copying (Unix-specific)

## Architecture Pattern
Progressive optimization strategy - tries least destructive options first, escalating to more aggressive compression only when needed. Early exit pattern prevents unnecessary quality degradation.