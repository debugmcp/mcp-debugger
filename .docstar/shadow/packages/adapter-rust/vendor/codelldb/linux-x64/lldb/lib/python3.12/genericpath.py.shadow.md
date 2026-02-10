# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/genericpath.py
@source-hash: 6a271770c5e0c0a5
@generated: 2026-02-09T18:09:36Z

**Primary Purpose:** Cross-platform path operation utilities providing OS-agnostic file system functions. Serves as a base module for OS-specific path implementations (posix, nt modules).

**Key Functions:**

- `exists(path)` (L16-22): Tests path existence using os.stat(), returns False for broken symlinks
- `isfile(path)` (L27-33): Checks if path is regular file using stat.S_ISREG()
- `isdir(s)` (L39-45): Checks if path is directory using stat.S_ISDIR()
- `islink(path)` (L51-57): Tests for symbolic links using os.lstat() and stat.S_ISLNK()

**File Metadata Functions:**
- `getsize(filename)` (L60-62): Returns file size via os.stat().st_size
- `getmtime(filename)` (L65-67): Returns modification time via os.stat().st_mtime
- `getatime(filename)` (L70-72): Returns access time via os.stat().st_atime
- `getctime(filename)` (L75-77): Returns metadata change time via os.stat().st_ctime

**Comparison Functions:**
- `samestat(s1, s2)` (L99-102): Compares stat buffers by inode and device numbers
- `samefile(f1, f2)` (L106-114): Compares file paths by stat comparison
- `sameopenfile(fp1, fp2)` (L119-123): Compares open file objects by fstat comparison

**Utility Functions:**
- `commonprefix(m)` (L81-95): Finds longest common prefix of pathname list, handles os.PathLike objects
- `_splitext(p, sep, altsep, extsep)` (L133-154): Generic extension splitting with separator parameters
- `_check_arg_types(funcname, *args)` (L156-166): Type validation ensuring no mixing of str/bytes

**Dependencies:** 
- `os` module for stat operations and path handling
- `stat` module for file type constants

**Architectural Patterns:**
- Defensive programming: All file operations wrapped in try/except blocks
- Follows symlinks by default (uses os.stat vs os.lstat except for islink)
- Supports both text and bytes strings consistently
- Type safety enforced through _check_arg_types helper

**Critical Constraints:**
- Functions follow symbolic links except islink()
- Error handling returns False rather than propagating exceptions for existence checks
- Mixed string/bytes types prohibited in path operations