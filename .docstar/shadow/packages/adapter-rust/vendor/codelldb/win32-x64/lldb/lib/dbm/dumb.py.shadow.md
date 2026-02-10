# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/dbm/dumb.py
@source-hash: c99202d9eb4e25a0
@generated: 2026-02-09T18:10:43Z

**Purpose & Responsibility**
A simple, file-based DBM (database manager) implementation providing key-value storage with a directory index file (`.dir`), binary data file (`.dat`), and optional backup file (`.bak`). Despite being "dumb and slow", it offers a complete MutableMapping interface for persistent storage.

**Architecture & File Structure**
- **Directory file (.dir)**: Text file storing index entries as `"%r, (%d, %d)\n"` (key, position, size)
- **Data file (.dat)**: Binary file with values stored at block-aligned offsets (`_BLOCKSIZE = 512`)
- **Backup file (.bak)**: Optional backup of directory file for crash recovery

**Key Classes & Functions**

**_Database (L35-289)**: Core DBM implementation extending `collections.abc.MutableMapping`
- `__init__(L48-72)`: Initializes file paths, mode, and calls `_create()` and `_update()`
- `_create(L74-90)`: Handles file creation based on flags ('n'=new, 'c'=create if needed)
- `_update(L93-108)`: Loads directory file into in-memory `_index` dict using `ast.literal_eval`
- `_commit(L113-137)`: Writes index to disk with atomic backup-and-rename strategy
- `__getitem__(L144-152)`: Retrieves values by seeking to position in data file
- `__setitem__(L187-223)`: Stores values, reusing space if new value fits in old blocks
- `_addval(L158-166)`: Appends new values to data file with block alignment
- `_setval(L172-176)`: Overwrites existing value at specific position
- `__delitem__(L224-237)`: Removes key from index and commits immediately
- Context manager support via `__enter__`/`__exit__` (L284-288)

**open(L291-317)**: Factory function creating `_Database` instances with umask-adjusted permissions

**Key Patterns & Invariants**
- **Encoding Strategy**: Keys/values accept strings (UTF-8 encoded) or bytes; directory uses Latin-1 for compatibility
- **Block Alignment**: All data values start at 512-byte boundaries for efficient access
- **Lazy Consistency**: Index and directory file may be out of sync until `_commit()` called
- **Crash Safety**: Uses backup-and-rename pattern in `_commit()` for atomic updates
- **Memory Efficiency**: Entire index loaded into memory (`_index` dict) on open

**Critical Dependencies**
- `ast.literal_eval()` for safe directory file parsing (L106)
- `os` and `io` modules stored as class attributes to avoid shutdown races (L45-46)
- Standard file operations with Latin-1 encoding for cross-platform compatibility

**Operational Constraints**
- **No Concurrent Access**: Multiple processes can corrupt the database
- **No Space Reclamation**: Deleted/expanded items leave unusable space
- **Performance**: Full index rewrite on updates, entire index loaded on open
- **Read-only Mode**: Partial support (flag='r' blocks writes but doesn't implement flag='m')