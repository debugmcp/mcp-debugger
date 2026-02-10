# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/zipfile/__init__.py
@source-hash: eb37f9fb0bb23795
@generated: 2026-02-09T18:06:30Z

## Primary Purpose

This is Python's standard zipfile module (`__init__.py`) providing comprehensive ZIP archive read/write functionality with support for multiple compression methods (stored, deflated, bzip2, lzma) and ZIP64 extensions for large files.

## Key Classes & Functions

### Core Classes

**ZipInfo (L360-594)** - Metadata container for individual ZIP archive entries
- Stores file attributes: filename, date_time, compress_type, file_size, CRC, etc.
- `FileHeader()` (L446-492): Generates binary file header for ZIP format
- `from_file()` (L545-581): Creates ZipInfo from filesystem file
- `is_dir()` (L583-593): Determines if entry represents directory

**ZipFile (L1266-2063)** - Main ZIP archive interface
- Constructor (L1292-1386): Opens ZIP files in read/write/append modes
- `open()` (L1570-1670): Returns file-like object for reading/writing entries
- `read()` (L1564-1568): Reads entire file content as bytes
- `write()` (L1829-1860): Adds file from filesystem to archive
- `writestr()` (L1862-1901): Adds file from string/bytes data
- `extract()` (L1714-1726): Extracts single file to filesystem
- `extractall()` (L1728-1744): Extracts all files to directory
- `_RealGetContents()` (L1408-1492): Parses ZIP central directory

**ZipExtFile (L839-1180)** - File-like object for reading ZIP entries
- Handles decompression, decryption, and seeking
- Supports all compression types with appropriate decompressors
- `read()` (L964-997): Main read method with buffering
- `seek()` (L1110-1171): Seeking support for uncompressed files

**PyZipFile (L2065-2236)** - Specialized for Python source/bytecode
- `writepy()` (L2074-2154): Recursively adds Python packages
- `_get_codename()` (L2156-2236): Handles .py/.pyc file selection and compilation

### Utility Classes

**_ZipWriteFile (L1182-1262)** - Write handle for creating new ZIP entries
**_SharedFile (L779-816)** - Thread-safe file wrapper for concurrent access
**_Tellable (L819-836)** - Adds tell() method to unseekable streams
**LZMACompressor/LZMADecompressor (L655-703)** - Custom LZMA codec implementation

## Key Functions

**is_zipfile() (L222-236)** - Fast ZIP format detection via magic number
**_EndRecData() (L281-339)** - Locates and parses end-of-central-directory record
**_EndRecData64() (L238-278)** - Handles ZIP64 end-of-central-directory extensions
**_sanitize_filename() (L341-357)** - Normalizes filenames for cross-platform compatibility

## Important Dependencies

- **zlib** (L17-22): DEFLATE compression (optional)
- **bz2** (L24-27): BZIP2 compression (optional)  
- **lzma** (L29-32): LZMA compression (optional)
- **threading.RLock**: Thread synchronization for concurrent access
- **struct**: Binary data packing/unpacking for ZIP format headers

## Constants & Limits

- ZIP64_LIMIT (L52): 2GB file size limit for standard ZIP
- ZIP_FILECOUNT_LIMIT (L53): 65535 file count limit
- Compression method constants: ZIP_STORED=0, ZIP_DEFLATED=8, ZIP_BZIP2=12, ZIP_LZMA=14 (L57-60)
- Version requirements for different features (L63-68)

## Architecture Patterns

- **Format parsing**: Extensive use of struct module for binary ZIP format compliance
- **Compression abstraction**: Pluggable compression via _get_compressor/_get_decompressor
- **Thread safety**: RLock protection for concurrent file access
- **Memory efficiency**: Streaming decompression with configurable buffer sizes
- **ZIP64 support**: Automatic fallback for large files/archives when enabled

## Key Invariants

- All filenames normalized to forward slashes internally
- CRC-32 validation on read operations when available
- Thread-safe operations when multiple readers access same ZipFile
- ZIP64 extensions automatically used when file sizes exceed standard limits
- Metadata encoding handled transparently (UTF-8 vs CP437)