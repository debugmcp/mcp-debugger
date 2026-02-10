# scripts/analyze_logo.py
@source-hash: ae3197aec27142a2
@generated: 2026-02-09T18:15:09Z

## Purpose
Script for analyzing logo image properties to assess marketplace suitability, particularly for resizing to 400x400px format.

## Key Function
**analyze_logo(path) (L5-33)**: Core analysis function that:
- Validates file existence (L7-9)
- Opens image using PIL (L11)
- Extracts basic properties: dimensions, color mode, format, transparency (L13-17)
- Calculates file size in KB (L20-21)
- Provides suitability assessment for 400x400px resizing (L24-33)
  - Checks for square aspect ratio (L25-28)
  - Validates resolution adequacy (L30-33)

## Dependencies
- **PIL (Pillow)**: Image processing library for opening and analyzing images (L2)
- **os**: File system operations for existence checks and size calculation (L3)
- **sys**: Command-line argument handling in main execution (L36)

## Execution Flow
**Main block (L35-38)**: 
- Accepts logo path from command line arguments or defaults to "logo.png"
- Calls analyze_logo() function directly

## Output Format
Console-based analysis report including:
- Image dimensions and technical properties
- File size metrics
- Visual suitability recommendations with checkmarks (✓) and warnings (⚠)

## Design Patterns
- Simple command-line utility pattern
- Defensive programming with file existence validation
- User-friendly output with visual indicators for quick assessment