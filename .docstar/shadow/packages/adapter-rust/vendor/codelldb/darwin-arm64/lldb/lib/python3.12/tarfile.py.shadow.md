# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/tarfile.py
@source-hash: b133c7b6da239f81
@generated: 2026-02-09T18:07:32Z

**Primary Purpose**: Complete implementation of TAR archive format reader/writer supporting multiple compression methods (gzip, bzip2, xz), POSIX/GNU/PAX formats, and security-aware extraction filtering.

**Core Classes**:

**TarInfo (L849-1644)**: Archive member metadata container
- Stores file attributes: name, mode, uid/gid, size, mtime, type, linkname (L884-906)
- File type detection methods: isreg(), isdir(), issym(), islnk(), etc. (L1606-1643)
- Header creation/parsing for different formats: create_ustar_header(), create_gnu_header(), create_pax_header() (L1002-1085)
- Binary serialization via tobuf() and deserialization via frombuf() (L985, L1230)
- Member processing methods _proc_member(), _proc_pax(), _proc_sparse() handle format-specific parsing (L1313-1522)

**TarFile (L1646-2810)**: Main TAR archive interface
- Multi-format support via class methods: taropen(), gzopen(), bz2open(), xzopen() (L1881-1976)
- Archive iteration and member access: getmember(), getmembers(), next() (L2010-2680)
- Extraction with filtering: extract(), extractall() with security filters (L2318-2316)
- File creation methods: makedir(), makefile(), makedev(), makelink() (L2473-2561)
- Archive writing: add(), addfile() for building archives (L2174-2248)

**Support Classes**:
- **_Stream (L331-574)**: Compression-aware stream adapter supporting gz/bz2/xz
- **_FileInFile (L606-708)**: Sparse file reader for extracting archive members
- **ExFileObject (L710-716)**: Buffered reader wrapper for extracted files
- **_StreamProxy (L576-601)**: Transparent compression detection

**Security Framework (PEP 706, L723-837)**:
- Filter functions: fully_trusted_filter, tar_filter, data_filter (L818-831)
- Exception classes: FilterError, AbsolutePathError, OutsideDestinationError, etc. (L723-753)
- Path validation via _get_filtered_attrs() prevents directory traversal attacks (L755-816)

**Format Constants**:
- TAR format types: USTAR_FORMAT, GNU_FORMAT, PAX_FORMAT (L106-109)
- File type constants: REGTYPE, DIRTYPE, SYMTYPE, etc. (L88-104)
- Field length limits: LENGTH_NAME, LENGTH_LINK, LENGTH_PREFIX (L84-86)

**Key Utilities**:
- Binary conversion: stn(), nts(), nti(), itn() for string/number field encoding (L159-223)
- Checksum calculation: calc_chksums() for header verification (L225-236)
- File copying: copyfileobj() with length limits (L238-261)

**Notable Patterns**:
- Compression method registration via OPEN_METH mapping (L1979-1984)
- Format-specific header processing via _proc_* method dispatch
- Lazy loading of archive members with _loaded flag
- Context manager support for automatic resource cleanup
- Extensive error handling with configurable error levels
- Security-first extraction with mandatory filtering in Python 3.14+

**Critical Dependencies**: os, sys, struct, shutil, stat, time, io, re, warnings, plus optional pwd/grp for Unix ownership and compression modules (zlib, bz2, lzma)