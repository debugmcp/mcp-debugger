# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/imghdr.py
@source-hash: c1bb52ea0816db4c
@generated: 2026-02-09T18:08:44Z

**Purpose**: Image format recognition module that identifies image file types by analyzing their binary headers/magic bytes. **Deprecated module** scheduled for removal in Python 3.13 (L9).

**Core Architecture**:
- **Main API**: `what(file, h=None)` (L16-34) - Primary function that returns image format string or None
- **Test Registry**: `tests` list (L41) - Global registry of format detection functions
- **Pattern**: Each format has a dedicated test function that examines header bytes and returns format name if matched

**Key Functions**:
- `what()` (L16-34): Accepts file path/object or raw bytes, reads first 32 bytes, iterates through test functions
- Format detection functions (L43-137): Each follows pattern `test_<format>(h, f)` returning format string or None
  - `test_jpeg()` (L43-49): Detects JFIF/Exif markers or raw JPEG signature
  - `test_png()` (L52-56): PNG signature validation  
  - `test_gif()` (L59-63): GIF87a/GIF89a headers
  - `test_tiff()` (L66-70): TIFF byte order markers (MM/II)
  - `test_rgb()` (L73-77): SGI image library format
  - `test_pbm/pgm/ppm()` (L80-102): Portable bitmap formats (P1-P6)
  - `test_rast()` (L104-108): Sun raster format
  - `test_xbm()` (L111-115): X bitmap format
  - `test_bmp()` (L118-122): Windows bitmap
  - `test_webp()` (L125-129): WebP format
  - `test_exr()` (L132-136): OpenEXR format

**Testing Infrastructure**:
- `test()` (L143-156): CLI entry point with recursive directory scanning
- `testall()` (L158-177): Recursive file processing utility

**Supported Formats**: JPEG, PNG, GIF, TIFF, RGB, PBM/PGM/PPM, Sun raster, XBM, BMP, WebP, OpenEXR

**Dependencies**: `os.PathLike`, `warnings` module

**Usage Pattern**: Each test function is automatically registered in `tests` list immediately after definition, enabling extensible format detection.