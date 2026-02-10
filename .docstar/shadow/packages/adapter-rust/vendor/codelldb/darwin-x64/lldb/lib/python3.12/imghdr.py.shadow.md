# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/imghdr.py
@source-hash: c1bb52ea0816db4c
@generated: 2026-02-09T18:07:45Z

## Purpose
Image format recognition module that identifies image types by examining file headers/magic bytes. This is a deprecated Python standard library module (deprecated as of Python 3.12, removal scheduled for 3.13).

## Core Functionality

**Main Entry Point:**
- `what(file, h=None)` (L16-34): Primary function that determines image format from file path/handle or byte header. Returns format string or None if unrecognized.

**Detection Strategy:**
- Reads first 32 bytes of file as signature
- Iterates through registered test functions in `tests` list (L41)
- Returns first matching format string

**Supported Formats (with test functions):**
- JPEG: `test_jpeg()` (L43-49) - detects JFIF/Exif markers or raw JPEG signature
- PNG: `test_png()` (L52-56) - PNG magic number
- GIF: `test_gif()` (L59-63) - GIF87a/GIF89a headers  
- TIFF: `test_tiff()` (L66-70) - Motorola/Intel byte order markers
- SGI RGB: `test_rgb()` (L73-77) - SGI image library format
- PBM/PGM/PPM: `test_pbm/pgm/ppm()` (L80-102) - Portable bitmap formats
- Sun Raster: `test_rast()` (L104-108) - Sun raster files
- XBM: `test_xbm()` (L111-115) - X bitmap format
- BMP: `test_bmp()` (L118-122) - Windows bitmap
- WebP: `test_webp()` (L125-129) - Google WebP format
- OpenEXR: `test_exr()` (L132-136) - High dynamic range format

**Test Infrastructure:**
- `test()` (L143-156): Command-line test driver with recursive option
- `testall()` (L158-177): Recursive file/directory processor for testing

## Architecture Pattern
Uses a registration pattern where test functions are appended to a global `tests` list and executed sequentially until a match is found. Each test function follows the signature `(header_bytes, file_handle) -> format_string | None`.

## Dependencies
- `os.PathLike` for path handling
- `warnings` for deprecation notice (L9)

## Key Constraints
- Reads maximum 32 bytes for format detection
- File handles are properly managed with try/finally cleanup
- Preserves file position for stream-like objects