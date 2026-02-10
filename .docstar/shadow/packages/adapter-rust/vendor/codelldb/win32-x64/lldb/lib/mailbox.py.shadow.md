# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/mailbox.py
@source-hash: 1c356f03e8df0b99
@generated: 2026-02-09T18:14:30Z

## Python Mailbox Library - Standard Email Mailbox Format Support

**Primary Purpose:** Provides read/write access to multiple mailbox formats (Maildir, mbox, MH, Babyl, MMDF) with a unified interface for email message storage and retrieval.

### Core Architecture

**Base Classes:**
- `Mailbox` (L34-265): Abstract base class providing dict-like interface for message storage
- `_singlefileMailbox` (L577-772): Base for single-file formats (mbox, MMDF, Babyl)  
- `Message` (L1494-1529): Enhanced email.message.Message with format-specific properties

**Concrete Mailbox Implementations:**
- `Maildir` (L267-575): qmail-style directory-based mailbox with new/cur/tmp subdirs
- `mbox` (L843-893): Unix mbox format with "From " line separators  
- `MMDF` (L895-937): MMDF format with \001\001\001\001 delimiters
- `MH` (L940-1242): MH format storing each message as separate numbered file
- `Babyl` (L1245-1491): Rmail Babyl format with visible/original headers

**Message Subclasses:**
- `MaildirMessage` (L1531-1637): Supports flags (DFRST), subdir (new/cur), delivery date
- `_mboxMMDFMessage` (L1640-1750): Base for mbox/MMDF with "From " line and Status headers
- `MHMessage` (L1757-1826): Supports MH sequences for message categorization
- `BabylMessage` (L1829-1921): Supports labels and visible header sets

### Key Patterns & Operations

**Mailbox Interface (L34-196):**
- Dict-like operations: `__getitem__`, `__setitem__`, `__delitem__`, `__contains__`
- Iterator methods: `keys()`, `values()`, `items()`, `iterkeys()`, `itervalues()`, `iteritems()`
- Message retrieval: `get_message()`, `get_string()`, `get_bytes()`, `get_file()`
- Persistence: `flush()`, `lock()`, `unlock()`, `close()`

**File Handling Utilities:**
- `_lock_file()` (L2065-2105): fcntl + dotfile locking
- `_create_carefully()` (L2114-2120): Atomic file creation with O_EXCL
- `_sync_flush()/_sync_close()` (L2128-2137): Force fsync for data integrity

**Format-Specific Features:**
- Maildir: Atomic operations via tmp directory, unique filename generation (L490-512)
- mbox: "From " line parsing, message boundary detection (L861-892)
- MH: Sequence management (.mh_sequences file), message packing (L1204-1228)
- Babyl: Label system, dual header sets (original + visible)

### Critical Invariants

1. **Atomicity**: Maildir uses link/rename for atomic message installation (L318-331)
2. **Locking**: Single-file formats use fcntl + dotfile locking for concurrent access
3. **Encoding**: ASCII-only string inputs enforced via `_string_to_bytes()` (L197-205)
4. **Sync Requirements**: All modifications must call fsync before close (L7 comment)

### Dependencies & Relationships

- **Core**: email, os, time, socket for message parsing and file operations
- **Optional**: fcntl for file locking (graceful fallback if unavailable)
- **Format Conversion**: Message classes support cross-format flag/property mapping via `_explain_to()` methods

### Exception Hierarchy (L2140-2153)
- `Error`: Base exception
- `NoSuchMailboxError`: Mailbox doesn't exist
- `NotEmptyError`: Non-empty mailbox deletion attempt  
- `ExternalClashError`: Concurrent access conflicts
- `FormatError`: Invalid mailbox format detected