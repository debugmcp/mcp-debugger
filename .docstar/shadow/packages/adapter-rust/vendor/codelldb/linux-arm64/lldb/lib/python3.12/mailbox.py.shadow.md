# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/mailbox.py
@source-hash: 1c356f03e8df0b99
@generated: 2026-02-09T18:09:24Z

**Primary Purpose:**
Python's mailbox module provides unified read/write interfaces for multiple email mailbox formats: Maildir, mbox, MH, Babyl, and MMDF. Core responsibility is abstracting mailbox operations through a dictionary-like interface while handling format-specific storage requirements.

**Core Architecture:**

**Base Classes:**
- `Mailbox` (L34-265): Abstract base providing dictionary-like interface (`__getitem__`, `__setitem__`, `keys()`, etc.) and format-agnostic operations. Defines template methods requiring subclass implementation.
- `_singlefileMailbox` (L577-773): Abstract base for single-file formats (mbox, MMDF, Babyl), handles file locking, table-of-contents generation, and atomic file replacement during updates.
- `_mboxMMDF` (L776-841): Shared implementation for mbox/MMDF formats handling "From " line parsing and Unix-from header management.

**Concrete Mailbox Implementations:**
- `Maildir` (L267-575): Qmail-style directory-based format with `new/`, `cur/`, `tmp/` subdirectories. Implements unique filename generation, flag/info parsing, and folder management.
- `mbox` (L843-893): Unix mbox format with "From " line separators. Handles message boundary detection and line-ending normalization.
- `MMDF` (L895-937): Similar to mbox but uses `\001\001\001\001` delimiters instead of "From " lines.
- `MH` (L940-1242): Numbered message files in directories with sequence management via `.mh_sequences` file.
- `Babyl` (L1245-1491): Rmail format with visible/invisible headers and label system.

**Message Classes:**
- `Message` (L1494-1529): Base email message wrapper extending `email.message.Message` with format conversion capabilities.
- `MaildirMessage` (L1531-1637): Adds Maildir-specific properties (flags, subdir, date, info string).
- `_mboxMMDFMessage` (L1640-1750): Handles mbox/MMDF "From " lines and Status/X-Status headers.
- `MHMessage` (L1757-1826): Manages MH sequence membership.
- `BabylMessage` (L1829-1921): Handles Babyl labels and visible header management.

**Key Utilities:**
- `_ProxyFile` (L1928-2024): Read-only file wrapper for safe message access.
- `_PartialFile` (L2026-2063): Bounded file reader for single-file formats.
- File operations (L2065-2137): Locking (`_lock_file`, `_unlock_file`), atomic creation (`_create_carefully`), and sync operations (`_sync_flush`, `_sync_close`).

**Critical Patterns:**
- **Template Method**: Base classes define workflow, subclasses implement specifics
- **Factory Pattern**: Optional message factory for custom message types  
- **Atomic Operations**: Updates use temp files + rename for crash safety
- **Format Conversion**: Messages can convert between formats via `_explain_to()` methods
- **Lazy Loading**: TOC generation and message parsing deferred until needed

**Important Dependencies:**
- `email.message`/`email.generator`: Core email handling
- `fcntl`: File locking (Unix systems)
- Standard library: `os`, `time`, `socket` for file ops and unique ID generation

**Critical Invariants:**
- Single-file formats maintain integrity through atomic replacement
- Maildir uses unique filenames to prevent collisions  
- All modifications must call `fsync()` before completion
- Message keys are format-specific but stable within format