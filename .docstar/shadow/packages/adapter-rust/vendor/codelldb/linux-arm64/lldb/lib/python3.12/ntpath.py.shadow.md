# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/ntpath.py
@source-hash: ffa7f85c0382a6e9
@generated: 2026-02-09T18:09:02Z

**Purpose**: Windows NT/95 pathname manipulation module providing cross-platform path operations with Windows-specific behavior. Part of Python's os.path interface for Windows systems.

**Key Constants (L11-18)**: Path separators and defaults - `sep='\\'`, `altsep='/'`, `pathsep=';'`, `curdir='.'`, `pardir='..'`, `extsep='.'`, `devnull='nul'`, `defpath='.;C:\\bin'`

**Core Path Parsing**:
- `splitroot(p)` (L179-228): Splits path into (drive, root, tail) components, handling UNC paths, device drives, and drive letters with comprehensive Windows path format support
- `splitdrive(p)` (L156-176): Legacy wrapper around splitroot, returns (drive_or_unc, path) tuple
- `split(p)` (L236-249): Splits path into (head, tail) where tail is final component
- `join(path, *paths)` (L107-150): Intelligent path joining with drive/root precedence logic

**Path Classification**:
- `isabs(s)` (L87-103): Tests absolute paths (UNC, device, drive+root patterns)
- `normcase(s)` (L51-78): Case normalization with Windows locale support via `_LCMapStringEx` or fallback to `.lower()`
- `ismount(path)` (L321-338): Mount point detection using `_getvolumepathname` or lexical analysis

**Path Transformation**:
- `normpath(path)` (L527-561): Path normalization eliminating double slashes, resolving '..' and '.' components
- `abspath(path)` (L588-593): Absolute path resolution using `_getfullpathname` or fallback
- `realpath(path, *, strict=False)` (L692-752): Resolves symlinks and final paths with Windows-specific error handling
- `expanduser(path)` (L350-395): Expands `~` using USERPROFILE/HOMEDRIVE+HOMEPATH environment variables
- `expandvars(path)` (L411-517): Shell variable expansion supporting `$var`, `${var}`, and `%var%` formats

**File System Queries**:
- `lexists(path)` (L299-305): Tests path existence including broken symlinks
- `isjunction(path)` (L283-294): Junction point detection via `st_reparse_tag` if available
- `isdevdrive(path)` (L884-889): Windows Dev Drive detection using `_path_isdevdrive`

**Utility Functions**:
- `basename(p)` (L268-270): Extract final path component via split()[1]
- `dirname(p)` (L275-277): Extract directory component via split()[0]
- `relpath(path, start=None)` (L758-801): Compute relative path between locations
- `commonpath(paths)` (L814-860): Find longest common path prefix with case-insensitive comparison

**Import Dependencies**: 
- Core: `os`, `sys`, `stat`, `genericpath`
- Windows-specific: `_winapi` (locale functions), `nt` (native path functions, volume operations)
- Conditional imports with graceful fallbacks for non-Windows systems

**Architecture Notes**:
- Extensive use of isinstance(path, bytes) for binary/text path handling
- Windows-specific optimizations via nt module functions when available
- Comprehensive error handling for Windows filesystem peculiarities
- Case-insensitive operations throughout with locale-aware normalization