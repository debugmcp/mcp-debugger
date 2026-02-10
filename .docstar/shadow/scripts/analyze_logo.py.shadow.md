# scripts/analyze_logo.py
@source-hash: ae3197aec27142a2
@generated: 2026-02-10T00:41:56Z

## Purpose
Command-line utility script for analyzing logo image properties to assess marketplace suitability, particularly for resizing to 400x400px format.

## Key Functions

### `analyze_logo(path)` (L5-33)
Core analysis function that examines image properties and provides suitability assessment:
- **Input validation**: Checks file existence (L7-9)
- **Image properties**: Extracts dimensions, color mode, format, transparency support (L11-17)
- **File metrics**: Calculates file size in KB (L19-21)
- **Resize assessment**: Evaluates aspect ratio and resolution suitability for 400x400px conversion (L24-33)

### Main execution block (L35-38)
- Accepts logo path from command line arguments or defaults to "logo.png"
- Directly invokes `analyze_logo()` function

## Dependencies
- **PIL (Pillow)**: Image processing and property extraction
- **os**: File system operations (existence check, file size)
- **sys**: Command-line argument parsing

## Key Assessment Criteria
- **Aspect ratio**: Square (1:1) preferred for resizing without cropping
- **Resolution**: Minimum 800px recommended for quality preservation
- **Transparency**: Detection of RGBA/LA modes
- **File size**: Reported in KB for optimization considerations

## Output Format
Structured console output with checkmarks (✓) and warnings (⚠) for visual assessment of marketplace readiness.

## Usage Pattern
Designed as standalone script: `python analyze_logo.py [path]` or `python analyze_logo.py` (uses default logo.png)