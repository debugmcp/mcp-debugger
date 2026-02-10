# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/imghdr.py
@source-hash: c1bb52ea0816db4c
@generated: 2026-02-09T18:07:13Z

## Purpose
Python image format detection module that identifies image file types by examining their binary headers (magic bytes). This is a deprecated Python standard library module (removal scheduled for Python 3.13) used for quick image format recognition without full image parsing.

## Core API
- **what(file, h=None) (L16-34)**: Main entry point that returns image format string or None. Accepts file path, file-like object, or pre-read header bytes. Reads first 32 bytes and tests against all registered format detectors.

## Format Detection Architecture
- **tests (L41)**: Global list containing all format detection functions, populated via append calls
- Each test function follows pattern: `test_<format>(h, f) -> str|None` where h is header bytes and f is file object
- Detection functions registered by appending to tests list after definition

## Supported Image Formats
Format detectors with their magic byte patterns:
- **test_jpeg (L43-49)**: JFIF/Exif markers at bytes 6-10 or raw JPEG signature `\xff\xd8\xff\xdb`
- **test_png (L52-55)**: PNG signature `\211PNG\r\n\032\n`
- **test_gif (L59-62)**: GIF87a or GIF89a signatures
- **test_tiff (L66-69)**: Motorola (MM) or Intel (II) byte order markers
- **test_rgb (L73-76)**: SGI image library format `\001\332`
- **test_pbm (L80-84)**: Portable bitmap P1/P4 with whitespace
- **test_pgm (L88-92)**: Portable graymap P2/P5 with whitespace
- **test_ppm (L96-100)**: Portable pixmap P3/P6 with whitespace
- **test_rast (L104-107)**: Sun raster format `\x59\xA6\x6A\x95`
- **test_xbm (L111-114)**: X bitmap starting with "#define "
- **test_bmp (L118-121)**: Bitmap format "BM" signature
- **test_webp (L125-128)**: WebP format with RIFF container and WEBP fourcc
- **test_exr (L132-135)**: OpenEXR format `\x76\x2f\x31\x01`

## Testing Infrastructure
- **test() (L143-156)**: Command-line test harness with recursive directory scanning option
- **testall() (L158-177)**: Recursive file processor that applies what() to files/directories

## Key Dependencies
- os.PathLike for path handling
- warnings module for deprecation notice (L9)

## Architecture Notes
- Uses strategy pattern with function registry for extensible format detection
- Reads minimal bytes (32) for efficiency
- Handles both file paths and file-like objects
- Proper file handle cleanup in finally block
- Sequential testing stops at first match