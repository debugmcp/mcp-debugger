# examples/visualizer/optimize_gif.py
@source-hash: 58b0db8328099909
@generated: 2026-02-10T00:41:43Z

## Purpose
Utility script for optimizing GIF files using gifsicle with progressive compression strategies to achieve target file sizes under 10MB while maintaining quality.

## Key Functions

### `optimize_gif()` (L8-103)
Main optimization function implementing a 4-level progressive compression strategy:
- Validates gifsicle installation (L11-17)
- Locates input GIF at `../../assets/demo.gif` relative to script location (L19)
- Creates backup file with `.original.gif` suffix (L26-29)
- Applies optimization levels in sequence until <10MB target is met:
  1. **Level 1** (L34-49): Basic optimization (`--optimize=3`)
  2. **Level 2** (L51-68): Color reduction to 128 colors
  3. **Level 3** (L70-86): Adds lossy compression (30% loss)
  4. **Level 4** (L88-101): Maximum compression (64 colors, 50% loss, 90% scale)
- Restores from backup between attempts (L53, L72, L89)

### `cleanup_backup()` (L105-118)
Post-optimization cleanup function:
- Calculates and displays compression statistics (L107-113)
- Prompts user to keep/remove backup file (L115-118)

## Dependencies
- **subprocess**: Shell command execution for gifsicle and file operations
- **pathlib.Path**: File system path manipulation
- **gifsicle** (external): GIF optimization tool, checked via `which` command (L11)

## Key Behaviors
- **Progressive optimization**: Stops at first level achieving <10MB target
- **Backup strategy**: Creates `.original.gif` backup before any modifications
- **Cross-platform installation guidance**: Provides OS-specific install instructions (L13-16)
- **File restoration**: Restores from backup between optimization attempts to avoid cumulative quality loss
- **Interactive cleanup**: User choice on backup retention with compression statistics

## File Path Assumptions
- Input GIF expected at `../../../assets/demo.gif` relative to script location
- Expects prior execution of `convert_to_gif.py` (mentioned in error message L23)