# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/tarfile.py
@source-hash: b133c7b6da239f81
@generated: 2026-02-09T18:08:21Z

## Python tarfile.py Module (LLDB Bundle)

Primary purpose: Comprehensive tar archive manipulation library providing read/write access to tar files with various compression formats (gzip, bzip2, lzma/xz). This is the standard Python tarfile module bundled with LLDB.

### Core Classes

**TarFile (L1646-2810)** - Main tar archive interface class
- Supports multiple modes: read ('r'), append ('a'), write ('w'), exclusive create ('x')
- Handles compressed archives via compression-specific open methods
- Key methods: `open()` (L1786), `add()` (L2174), `extract()` (L2318), `extractall()` (L2273)
- Extraction filtering system with security filters (L2250-2271)

**TarInfo (L849-1644)** - Tar header information container
- Stores all tar member metadata: name, mode, uid, gid, size, mtime, type, etc.
- File type detection methods: `isreg()` (L1606), `isdir()` (L1614), `issym()` (L1618), etc.
- Header creation for different formats: `create_ustar_header()` (L1002), `create_gnu_header()` (L1015), `create_pax_header()` (L1029)
- PAX extended header processing (L1403-1522)

**_Stream (L331-574)** - Stream-based tar processing with compression support
- Handles transparent compression detection and streaming I/O
- Supports gzip, bzip2, and xz/lzma compression formats
- Used for pipe-mode operations ('r|', 'w|')

**ExFileObject (L710-716)** - Buffered file object for extracted tar members
- Wraps _FileInFile for efficient reading of archive members

### Utility Classes

**_FileInFile (L606-708)** - Virtual file object for archive members
- Provides file-like interface to portions of the archive
- Supports sparse file handling via block mapping

**_StreamProxy (L576-601)** - Compression format auto-detection
- Examines file headers to determine compression type

### Constants and Configuration

**Format Constants (L106-109)**:
- `USTAR_FORMAT` (0): POSIX.1-1988 format
- `GNU_FORMAT` (1): GNU tar extensions  
- `PAX_FORMAT` (2): POSIX.1-2001 extended format
- `DEFAULT_FORMAT`: Set to PAX_FORMAT

**File Type Constants (L88-104)**: REGTYPE, DIRTYPE, SYMTYPE, etc.

**Block/Record Sizes (L79-80)**: BLOCKSIZE=512, RECORDSIZE=10240

### Extraction Security (PEP 706 Implementation, L723-837)

**Filter Functions**:
- `fully_trusted_filter()` (L818): No restrictions
- `tar_filter()` (L821): Basic safety checks
- `data_filter()` (L827): Strict security filtering

**Security Exceptions (L726-753)**: AbsolutePathError, OutsideDestinationError, SpecialFileError, etc.

### Compression Support

**Compression Methods (L1979-1983)**:
- `taropen()` (L1882): Uncompressed tar
- `gzopen()` (L1890): Gzip compression
- `bz2open()` (L1923): Bzip2 compression  
- `xzopen()` (L1951): LZMA/XZ compression

### Key Utility Functions

**Header Processing**:
- `nti()` (L175): Convert tar number field to Python int
- `itn()` (L195): Convert Python number to tar field
- `nts()` (L167): Null-terminated string conversion
- `stn()` (L159): String to null-terminated bytes

**File Operations**:
- `copyfileobj()` (L238): Efficient file copying with length limit
- `calc_chksums()` (L225): Calculate tar header checksums

### Command Line Interface

**main() function (L837-933)**: Complete CLI for tar operations
- List, extract, create, and test tar archives
- Supports compression format auto-detection
- Integrated with extraction filtering system

### Architecture Notes

- Extensible design allowing subclassing of TarFile and TarInfo
- Lazy loading of archive members for memory efficiency
- Comprehensive error handling hierarchy based on TarError (L270)
- Platform-aware file handling (Windows/Unix differences)
- Support for both seekable and stream-only file objects