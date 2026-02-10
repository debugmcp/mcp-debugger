# scripts/resize_logo.py
@source-hash: adbb8699f490f690
@generated: 2026-02-10T00:42:00Z

## Purpose
Utility script for resizing logo images to meet Cline Marketplace requirements. Provides both programmatic API and CLI interface for high-quality image resizing with automatic directory creation and verification.

## Key Components

### `resize_logo()` function (L6-45)
Primary function that handles the complete logo resizing workflow:
- **Parameters**: `input_path` (default "logo.png"), `output_path` (default "assets/logo.png"), `size` (default 400x400px)
- **Returns**: Boolean success/failure status
- **Directory handling** (L16-19): Auto-creates output directories using `os.makedirs()`
- **Image processing** (L23-30): Uses PIL with LANCZOS resampling for high-quality downsampling
- **Verification** (L33-39): Validates output by reopening saved file and reporting metrics
- **Error handling** (L43-45): Catches all exceptions and returns False on failure

### CLI Interface (L47-53)
Command-line execution support:
- **Argument parsing** (L49-50): Accepts optional input/output paths via `sys.argv`
- **Exit codes** (L53): Returns 0 for success, 1 for failure

## Dependencies
- **PIL/Pillow**: Core image processing (`Image.open()`, `resize()`, `save()`)
- **os**: File system operations (`makedirs()`, `path` utilities, `getsize()`)
- **sys**: Command-line arguments and exit codes

## Key Behaviors
- **Quality optimization**: Uses LANCZOS resampling algorithm for superior downsampling quality
- **PNG optimization**: Saves with `optimize=True` flag for smaller file sizes
- **Verbose output**: Provides detailed console feedback including original/new dimensions and file size
- **Defensive programming**: Creates missing directories automatically, verifies results post-save

## Usage Patterns
1. **Programmatic**: `resize_logo("source.png", "output/logo.png", (300, 300))`
2. **CLI default**: `python resize_logo.py` (uses default paths)
3. **CLI custom**: `python resize_logo.py input.png assets/resized.png`

## Critical Constraints
- Fixed to PNG output format only
- Hardcoded 400x400px default size for marketplace compliance
- No aspect ratio preservation logic (stretches to exact dimensions)