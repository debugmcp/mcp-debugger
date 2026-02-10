# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/imghdr.py
@source-hash: c1bb52ea0816db4c
@generated: 2026-02-09T18:09:43Z

## Image Format Recognition Library

**Primary Purpose**: Recognizes image file formats by examining file headers (magic bytes) in the first 32 bytes of files. This is a deprecated Python standard library module scheduled for removal in Python 3.13.

**Core API**:
- `what(file, h=None)` (L16-34): Main entry point that returns image format string or None
  - Accepts file path, file-like object, or pre-read header bytes
  - Reads first 32 bytes and tests against all registered format detectors
  - Handles file opening/closing automatically for path inputs

**Supported Image Formats** (via test functions L43-137):
- JPEG (L43-49): Detects JFIF/Exif markers or raw JPEG signature
- PNG (L52-55): Standard PNG file signature  
- GIF (L59-62): GIF87a and GIF89a variants
- TIFF (L66-69): Both Motorola (MM) and Intel (II) byte orders
- SGI RGB (L73-76): Silicon Graphics image format
- PBM/PGM/PPM (L80-101): Portable bitmap formats (P1-P6)
- Sun Raster (L104-107): Sun workstation raster format
- XBM (L111-114): X Window bitmap (text-based)
- BMP (L118-121): Windows bitmap format
- WebP (L125-128): Google WebP format (RIFF container)
- OpenEXR (L132-135): High dynamic range format

**Architecture**:
- `tests` list (L41): Registry of detection functions, populated via append calls
- Each test function follows pattern: `test_format(h, f)` returning format string or None
- Sequential testing through all registered detectors until match found

**Testing Infrastructure** (L143-177):
- `test()` (L143-156): Command-line interface with recursive directory option
- `testall()` (L158-177): Recursive file/directory processor for bulk testing

**Dependencies**: 
- Standard library only: `os.PathLike`, `warnings`, `sys`, `glob`
- Deprecated module warning issued at import (L9)

**Key Constraints**:
- Header detection limited to first 32 bytes
- Format detection is heuristic-based on magic bytes only
- No validation of complete file structure