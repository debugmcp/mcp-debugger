# scripts/resize_logo.py
@source-hash: adbb8699f490f690
@generated: 2026-02-09T18:15:12Z

## Purpose
Utility script for resizing logo images to meet Cline Marketplace requirements. Provides both programmatic API and command-line interface for image resizing with high-quality resampling.

## Key Components

### `resize_logo()` function (L6-45)
Primary image processing function that handles the complete resize workflow:
- **Parameters**: `input_path` (default: "logo.png"), `output_path` (default: "assets/logo.png"), `size` (default: 400x400px)
- **Returns**: Boolean indicating success/failure
- **Core operations**:
  - Directory creation with `os.makedirs()` (L16-19)
  - Image loading via PIL/Pillow (L23)
  - High-quality resize using LANCZOS resampling (L27)
  - PNG optimization on save (L30)
  - File verification and size reporting (L33-39)

### Command-line interface (L47-53)
Script entry point supporting optional command-line arguments:
- `sys.argv[1]`: custom input path
- `sys.argv[2]`: custom output path
- Exit code 0 on success, 1 on failure

## Dependencies
- **PIL (Pillow)**: Image processing library for resize operations
- **os**: File system operations (directory creation, path handling)
- **sys**: Command-line argument parsing and exit codes

## Technical Details
- Uses `Image.Resampling.LANCZOS` for high-quality downsampling (L27)
- Saves with PNG optimization enabled (L30)
- Creates output directories automatically if they don't exist (L16-18)
- Provides detailed console feedback including original size, new size, and file size in KB
- Robust error handling with try-catch around image operations (L22-45)

## Usage Patterns
- Default behavior: resize "logo.png" to 400x400px and save to "assets/logo.png"
- Can be imported as module or run as standalone script
- Suitable for CI/CD pipelines or manual logo preparation workflows