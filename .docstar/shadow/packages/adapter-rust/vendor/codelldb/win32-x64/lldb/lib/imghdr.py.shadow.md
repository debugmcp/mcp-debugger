# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/imghdr.py
@source-hash: c1bb52ea0816db4c
@generated: 2026-02-09T18:12:54Z

## Purpose & Responsibility
Image format recognition library that identifies file types by examining magic bytes in file headers. Part of Python's deprecated `imghdr` module, scheduled for removal in Python 3.13.

## Core API
- **`what(file, h=None)` (L16-34)**: Main entry point that determines image format from file path, file object, or raw header bytes. Returns format string or None.

## Detection Architecture
The module uses a registry pattern with test functions stored in the `tests` list (L41). Each test function examines the first 32 bytes of a file and returns a format string if recognized.

### Supported Formats & Test Functions
- **JPEG** (L43-49): Detects JFIF/Exif markers or raw JPEG signature `\xff\xd8\xff\xdb`
- **PNG** (L52-55): Recognizes PNG signature `\211PNG\r\n\032\n`
- **GIF** (L59-62): Identifies GIF87a and GIF89a variants
- **TIFF** (L66-69): Detects both Motorola (MM) and Intel (II) byte order variants
- **SGI RGB** (L73-76): Silicon Graphics image format via `\001\332` signature
- **PBM/PGM/PPM** (L80-101): Portable bitmap formats (P1/P4, P2/P5, P3/P6)
- **Sun Raster** (L104-107): Sun workstation format via `\x59\xA6\x6A\x95`
- **XBM** (L111-114): X Window bitmap via `#define ` text signature
- **BMP** (L118-121): Windows bitmap via `BM` signature
- **WebP** (L125-128): Google WebP via RIFF container with WEBP fourcc
- **OpenEXR** (L132-135): HDR format via `\x76\x2f\x31\x01` signature

## File Handling
The `what()` function handles multiple input types:
- String/PathLike paths: Opens file in binary mode
- File objects: Preserves current position using tell/seek
- Raw bytes: Direct header analysis

## Testing Infrastructure
- **`test()` (L143-156)**: Command-line interface with optional recursive flag
- **`testall()` (L158-177)**: Recursive directory traversal and format reporting

## Dependencies
- `os.PathLike` for path handling
- `warnings` for deprecation notice (L9)

## Architectural Notes
- Registry pattern allows easy extension of supported formats
- Each test function receives both header bytes and file object (though most only use header)
- Consistent 32-byte header reading provides sufficient data for all format detection
- Graceful error handling with file cleanup in finally blocks