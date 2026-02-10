# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/mailbox.py
@source-hash: 1c356f03e8df0b99
@generated: 2026-02-09T18:07:21Z

## Primary Purpose
Python standard library module providing unified read/write access to multiple mailbox formats (Maildir, mbox, MH, Babyl, MMDF). Implements a common interface for mailbox operations with format-specific subclasses and message types.

## Core Architecture

### Base Classes
- **Mailbox (L34-265)**: Abstract base class defining the mailbox interface. Provides dictionary-like operations (get/set/del items), iteration, and message manipulation. Key methods require subclass implementation.
- **_singlefileMailbox (L577-774)**: Base class for single-file formats (mbox, MMDF, Babyl). Handles file locking, TOC generation, and atomic writes via temporary files.
- **Message (L1494-1529)**: Base message class extending email.message.Message with format conversion capabilities.

### Mailbox Format Implementations
- **Maildir (L267-575)**: qmail-style mailbox with separate directories (tmp/new/cur). Uses unique filenames and file-based locking. No flush needed as changes are immediate.
- **mbox (L843-893)**: Classic Unix mbox format with "From " separators. Inherits from _mboxMMDF with newline handling.
- **MMDF (L895-937)**: Similar to mbox but uses `\001\001\001\001` delimiters. 
- **MH (L940-1242)**: Directory-based format with numbered message files and sequence tracking via .mh_sequences.
- **Babyl (L1245-1491)**: Emacs Rmail format with visible/original headers and label system.

### Message Format Classes
- **MaildirMessage (L1531-1637)**: Supports flags (PRST), subdir (new/cur), and delivery date
- **_mboxMMDFMessage (L1640-1750)**: Base for mbox/MMDF with "From " line and Status/X-Status headers
- **MHMessage (L1757-1826)**: Sequence-based message classification
- **BabylMessage (L1829-1921)**: Label system and visible header management

## Key Design Patterns

### Format Conversion
All message classes implement `_explain_to()` methods for cross-format conversion, mapping format-specific attributes (flags ↔ sequences ↔ labels).

### Thread Safety & Locking
- File locking via fcntl.lockf() and dot-lock files (L2065-2112)
- Atomic operations using temporary files with rename
- Sync operations (_sync_flush/close) ensure disk persistence

### File Handling Utilities
- **_ProxyFile (L1928-2023)**: Read-only file wrapper with position tracking
- **_PartialFile (L2026-2063)**: Bounded file access for message extraction
- **_create_carefully/temporary (L2114-2126)**: Safe file creation

## Critical Constraints

### Data Integrity
- All modifications must call flush() before close()
- Single-file formats use TOC (table of contents) for message boundaries
- File size validation prevents external modification conflicts

### Format-Specific Behavior
- Maildir: Immediate writes, no locking, filesystem-based
- mbox/MMDF: Requires "From " line mangling to prevent false separators
- MH: Numeric message keys, sequence file management
- Babyl: Dual header system (original + visible)

## Dependencies
- **email module**: Message parsing and generation
- **fcntl**: File locking (Unix-only, graceful fallback)
- **Standard libs**: os, time, socket for file ops and unique ID generation

## Error Hierarchy
Custom exceptions (L2140-2152): NoSuchMailboxError, NotEmptyError, ExternalClashError, FormatError - all inherit from base Error class.